// Integrazione con Google Identity Services (OAuth2 token client) per ottenere
// un access token con scope "drive.file": l'app puo' leggere/scrivere solo i
// file che essa stessa crea nel Google Drive dell'utente.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const USERINFO_SCOPES =
  "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
export const OAUTH_SCOPES = `${DRIVE_SCOPE} ${USERINFO_SCOPES}`;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const STORAGE_KEY = "gestionale-impianti:google-token";
const GIS_SRC = "https://accounts.google.com/gsi/client";

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

let gisLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile caricare Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

function readStoredToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.accessToken || Date.now() >= parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredToken(token: StoredToken | null) {
  if (!token) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

export function getClientIdConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

/**
 * Richiede un access token. `interactive: false` tenta un refresh silenzioso
 * (nessun popup); se fallisce, il chiamante deve ritentare con `interactive: true`.
 * Un nuovo TokenClient viene creato ad ogni chiamata perche' il callback GIS
 * e' fissato in fase di init e qui serve una Promise per ogni richiesta.
 */
export async function requestAccessToken(opts: { interactive: boolean }): Promise<string> {
  const cached = readStoredToken();
  if (cached) return cached.accessToken;

  if (!CLIENT_ID) {
    throw new Error(
      "VITE_GOOGLE_CLIENT_ID non configurato. Vedi README per creare un OAuth Client ID su Google Cloud Console.",
    );
  }
  await loadGisScript();

  return new Promise((resolve, reject) => {
    const client: TokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: OAUTH_SCOPES,
      callback: (resp: TokenResponse) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || "Login Google annullato"));
          return;
        }
        const stored: StoredToken = {
          accessToken: resp.access_token,
          // Google non comunica l'expiry nel callback base: usiamo 50 minuti prudenziali.
          expiresAt: Date.now() + 50 * 60 * 1000,
        };
        writeStoredToken(stored);
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(`Login Google fallito: ${err.type}`));
      },
    });
    client.requestAccessToken({ prompt: opts.interactive ? "consent" : "" });
  });
}

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Impossibile recuperare il profilo Google");
  const data = await res.json();
  return { name: data.name ?? data.email, email: data.email, picture: data.picture ?? "" };
}

export async function signOut(accessToken: string | null): Promise<void> {
  writeStoredToken(null);
  if (!accessToken) return;
  try {
    await loadGisScript();
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(accessToken, () => resolve());
    });
  } catch {
    // revoca best-effort: se fallisce il token e' comunque scaduto/rimosso localmente
  }
}

export function getCachedAccessToken(): string | null {
  return readStoredToken()?.accessToken ?? null;
}
