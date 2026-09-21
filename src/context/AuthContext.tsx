import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  fetchGoogleUser,
  getCachedAccessToken,
  getClientIdConfigured,
  requestAccessToken,
  signOut,
  type GoogleUser,
} from "../lib/googleAuth";

type AuthStatus = "idle" | "loading" | "authenticated" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: GoogleUser | null;
  accessToken: string | null;
  error: string | null;
  clientIdConfigured: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientIdConfigured = getClientIdConfigured();

  useEffect(() => {
    const cached = getCachedAccessToken();
    if (!cached) return;
    setStatus("loading");
    fetchGoogleUser(cached)
      .then((u) => {
        setAccessToken(cached);
        setUser(u);
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("idle");
      });
  }, []);

  const login = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const token = await requestAccessToken({ interactive: true });
      const u = await fetchGoogleUser(token);
      setAccessToken(token);
      setUser(u);
      setStatus("authenticated");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Login Google fallito");
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(accessToken);
    setAccessToken(null);
    setUser(null);
    setStatus("idle");
  }, [accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, accessToken, error, clientIdConfigured, login, logout }),
    [status, user, accessToken, error, clientIdConfigured, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
