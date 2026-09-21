// Wrapper minimale sulle Google Drive API v3 (REST, via fetch) usato per
// salvare i dati del gestionale e gli allegati nel Drive dell'utente,
// all'interno di un'unica cartella creata dall'app ("Gestionale Impianti").
// Richiede lo scope drive.file: l'app vede solo i file che crea.

const API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

const APP_FOLDER_NAME = "Gestionale Impianti";
const DATA_FILE_NAME = "dati-gestionale.json";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveApiError extends Error {}

async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DriveApiError(`Drive API ${res.status}: ${body || res.statusText}`);
  }
  return res;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

async function findFile(
  token: string,
  query: string,
  fields = "files(id,name,mimeType,webViewLink)",
): Promise<DriveFile[]> {
  const url = `${API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&spaces=drive`;
  const res = await driveFetch(token, url);
  const data = await res.json();
  return data.files ?? [];
}

export async function ensureAppFolder(token: string): Promise<string> {
  const escaped = APP_FOLDER_NAME.replace(/'/g, "\\'");
  const found = await findFile(
    token,
    `name='${escaped}' and mimeType='${FOLDER_MIME}' and trashed=false`,
  );
  if (found[0]) return found[0].id;

  const res = await driveFetch(token, `${API_BASE}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const data = await res.json();
  return data.id;
}

export async function ensureDataFile(token: string, folderId: string): Promise<string> {
  const escaped = DATA_FILE_NAME.replace(/'/g, "\\'");
  const found = await findFile(
    token,
    `name='${escaped}' and '${folderId}' in parents and trashed=false`,
  );
  if (found[0]) return found[0].id;

  const id = await multipartCreate(token, {
    metadata: { name: DATA_FILE_NAME, parents: [folderId], mimeType: "application/json" },
    content: JSON.stringify({ version: 1, cantieri: [] }),
    contentType: "application/json",
  });
  return id;
}

export async function readJsonFile<T>(token: string, fileId: string): Promise<T> {
  const res = await driveFetch(token, `${API_BASE}/files/${fileId}?alt=media`);
  return res.json();
}

export async function writeJsonFile(token: string, fileId: string, data: unknown): Promise<void> {
  await driveFetch(token, `${UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function ensureSubfolder(
  token: string,
  parentId: string,
  name: string,
): Promise<string> {
  const escaped = name.replace(/'/g, "\\'");
  const found = await findFile(
    token,
    `name='${escaped}' and '${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
  );
  if (found[0]) return found[0].id;

  const res = await driveFetch(token, `${API_BASE}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  const data = await res.json();
  return data.id;
}

interface UploadedAttachment {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

export async function uploadAttachment(
  token: string,
  folderId: string,
  file: File,
): Promise<UploadedAttachment> {
  const id = await multipartCreate(token, {
    metadata: { name: file.name, parents: [folderId] },
    content: file,
    contentType: file.type || "application/octet-stream",
  });
  const res = await driveFetch(
    token,
    `${API_BASE}/files/${id}?fields=id,name,mimeType,webViewLink`,
  );
  const meta = (await res.json()) as DriveFile;
  return {
    id: meta.id,
    name: meta.name,
    mimeType: meta.mimeType,
    webViewLink: meta.webViewLink ?? "",
  };
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  await driveFetch(token, `${API_BASE}/files/${fileId}`, { method: "DELETE" });
}

async function multipartCreate(
  token: string,
  opts: { metadata: Record<string, unknown>; content: string | Blob; contentType: string },
): Promise<string> {
  const boundary = `gi-boundary-${crypto.randomUUID()}`;
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    opts.metadata,
  )}\r\n`;
  const contentHeader = `--${boundary}\r\nContent-Type: ${opts.contentType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const body = new Blob([metadataPart, contentHeader, opts.content, closing]);

  const res = await driveFetch(
    token,
    `${UPLOAD_BASE}/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const data = await res.json();
  return data.id;
}
