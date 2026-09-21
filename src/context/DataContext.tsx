import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  deleteFile,
  ensureAppFolder,
  ensureDataFile,
  ensureSubfolder,
  readJsonFile,
  uploadAttachment,
  writeJsonFile,
} from "../lib/driveApi";
import * as ops from "../lib/dataOps";
import { emptyData } from "../types";
import type { Allegato, Cantiere, GestionaleData, Impianto, Intervento } from "../types";

type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

interface DataContextValue {
  data: GestionaleData | null;
  syncStatus: SyncStatus;
  error: string | null;

  createCantiere: (input: Omit<Cantiere, "id" | "impianti" | "allegati">) => void;
  editCantiere: (id: string, patch: Partial<Cantiere>) => void;
  deleteCantiere: (id: string) => void;

  createImpianto: (
    cantiereId: string,
    input: Omit<Impianto, "id" | "interventi" | "allegati">,
  ) => void;
  editImpianto: (cantiereId: string, impiantoId: string, patch: Partial<Impianto>) => void;
  deleteImpianto: (cantiereId: string, impiantoId: string) => void;

  createIntervento: (
    cantiereId: string,
    impiantoId: string,
    input: Omit<Intervento, "id">,
  ) => void;
  editIntervento: (
    cantiereId: string,
    impiantoId: string,
    interventoId: string,
    patch: Partial<Intervento>,
  ) => void;
  deleteIntervento: (cantiereId: string, impiantoId: string, interventoId: string) => void;

  uploadAllegatoCantiere: (cantiereId: string, file: File) => Promise<void>;
  removeAllegatoCantiere: (cantiereId: string, allegato: Allegato) => Promise<void>;
  uploadAllegatoImpianto: (
    cantiereId: string,
    impiantoId: string,
    file: File,
  ) => Promise<void>;
  removeAllegatoImpianto: (
    cantiereId: string,
    impiantoId: string,
    allegato: Allegato,
  ) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 1500;

export function DataProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [data, setData] = useState<GestionaleData | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const folderIdRef = useRef<string | null>(null);
  const dataFileIdRef = useRef<string | null>(null);
  const cantiereFolderCache = useRef<Map<string, string>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const loadedForToken = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setData(null);
      folderIdRef.current = null;
      dataFileIdRef.current = null;
      cantiereFolderCache.current.clear();
      loadedForToken.current = null;
      setSyncStatus("idle");
      return;
    }
    if (loadedForToken.current === accessToken) return;
    loadedForToken.current = accessToken;

    let cancelled = false;
    setSyncStatus("loading");
    setError(null);
    (async () => {
      try {
        const folderId = await ensureAppFolder(accessToken);
        const fileId = await ensureDataFile(accessToken, folderId);
        const loaded = await readJsonFile<GestionaleData>(accessToken, fileId);
        if (cancelled) return;
        folderIdRef.current = folderId;
        dataFileIdRef.current = fileId;
        skipNextSave.current = true;
        setData({ ...emptyData, ...loaded });
        setSyncStatus("saved");
      } catch (err) {
        if (cancelled) return;
        setSyncStatus("error");
        setError(err instanceof Error ? err.message : "Errore nel caricamento dati da Drive");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!data || !accessToken || !dataFileIdRef.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSyncStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await writeJsonFile(accessToken, dataFileIdRef.current!, data);
        setSyncStatus("saved");
      } catch (err) {
        setSyncStatus("error");
        setError(err instanceof Error ? err.message : "Errore nel salvataggio su Drive");
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const getCantiereFolder = useCallback(
    async (cantiere: Cantiere): Promise<string> => {
      if (!accessToken || !folderIdRef.current) {
        throw new Error("Drive non ancora inizializzato");
      }
      const cached = cantiereFolderCache.current.get(cantiere.id);
      if (cached) return cached;
      const folderName = `Allegati - ${cantiere.nome} (${cantiere.id.slice(0, 8)})`;
      const id = await ensureSubfolder(accessToken, folderIdRef.current, folderName);
      cantiereFolderCache.current.set(cantiere.id, id);
      return id;
    },
    [accessToken],
  );

  const createCantiere = useCallback<DataContextValue["createCantiere"]>((input) => {
    setData((prev) =>
      prev
        ? ops.addCantiere(prev, { ...input, id: ops.newId(), impianti: [], allegati: [] })
        : prev,
    );
  }, []);

  const editCantiere = useCallback<DataContextValue["editCantiere"]>((id, patch) => {
    setData((prev) => (prev ? ops.updateCantiere(prev, id, patch) : prev));
  }, []);

  const deleteCantiere = useCallback<DataContextValue["deleteCantiere"]>((id) => {
    cantiereFolderCache.current.delete(id);
    setData((prev) => (prev ? ops.removeCantiere(prev, id) : prev));
  }, []);

  const createImpianto = useCallback<DataContextValue["createImpianto"]>(
    (cantiereId, input) => {
      setData((prev) =>
        prev
          ? ops.addImpianto(prev, cantiereId, {
              ...input,
              id: ops.newId(),
              interventi: [],
              allegati: [],
            })
          : prev,
      );
    },
    [],
  );

  const editImpianto = useCallback<DataContextValue["editImpianto"]>(
    (cantiereId, impiantoId, patch) => {
      setData((prev) => (prev ? ops.updateImpianto(prev, cantiereId, impiantoId, patch) : prev));
    },
    [],
  );

  const deleteImpianto = useCallback<DataContextValue["deleteImpianto"]>(
    (cantiereId, impiantoId) => {
      setData((prev) => (prev ? ops.removeImpianto(prev, cantiereId, impiantoId) : prev));
    },
    [],
  );

  const createIntervento = useCallback<DataContextValue["createIntervento"]>(
    (cantiereId, impiantoId, input) => {
      setData((prev) =>
        prev
          ? ops.addIntervento(prev, cantiereId, impiantoId, { ...input, id: ops.newId() })
          : prev,
      );
    },
    [],
  );

  const editIntervento = useCallback<DataContextValue["editIntervento"]>(
    (cantiereId, impiantoId, interventoId, patch) => {
      setData((prev) =>
        prev ? ops.updateIntervento(prev, cantiereId, impiantoId, interventoId, patch) : prev,
      );
    },
    [],
  );

  const deleteIntervento = useCallback<DataContextValue["deleteIntervento"]>(
    (cantiereId, impiantoId, interventoId) => {
      setData((prev) =>
        prev ? ops.removeIntervento(prev, cantiereId, impiantoId, interventoId) : prev,
      );
    },
    [],
  );

  const uploadAllegatoCantiere = useCallback<DataContextValue["uploadAllegatoCantiere"]>(
    async (cantiereId, file) => {
      if (!accessToken || !data) return;
      const cantiere = data.cantieri.find((c) => c.id === cantiereId);
      if (!cantiere) return;
      const folderId = await getCantiereFolder(cantiere);
      const uploaded = await uploadAttachment(accessToken, folderId, file);
      const allegato: Allegato = {
        id: ops.newId(),
        driveFileId: uploaded.id,
        nome: uploaded.name,
        mimeType: uploaded.mimeType,
        webViewLink: uploaded.webViewLink,
        caricatoIl: new Date().toISOString(),
      };
      setData((prev) => (prev ? ops.addAllegatoCantiere(prev, cantiereId, allegato) : prev));
    },
    [accessToken, data, getCantiereFolder],
  );

  const removeAllegatoCantiere = useCallback<DataContextValue["removeAllegatoCantiere"]>(
    async (cantiereId, allegato) => {
      if (!accessToken) return;
      await deleteFile(accessToken, allegato.driveFileId);
      setData((prev) =>
        prev ? ops.removeAllegatoCantiere(prev, cantiereId, allegato.id) : prev,
      );
    },
    [accessToken],
  );

  const uploadAllegatoImpianto = useCallback<DataContextValue["uploadAllegatoImpianto"]>(
    async (cantiereId, impiantoId, file) => {
      if (!accessToken || !data) return;
      const cantiere = data.cantieri.find((c) => c.id === cantiereId);
      if (!cantiere) return;
      const folderId = await getCantiereFolder(cantiere);
      const uploaded = await uploadAttachment(accessToken, folderId, file);
      const allegato: Allegato = {
        id: ops.newId(),
        driveFileId: uploaded.id,
        nome: uploaded.name,
        mimeType: uploaded.mimeType,
        webViewLink: uploaded.webViewLink,
        caricatoIl: new Date().toISOString(),
      };
      setData((prev) =>
        prev ? ops.addAllegatoImpianto(prev, cantiereId, impiantoId, allegato) : prev,
      );
    },
    [accessToken, data, getCantiereFolder],
  );

  const removeAllegatoImpianto = useCallback<DataContextValue["removeAllegatoImpianto"]>(
    async (cantiereId, impiantoId, allegato) => {
      if (!accessToken) return;
      await deleteFile(accessToken, allegato.driveFileId);
      setData((prev) =>
        prev ? ops.removeAllegatoImpianto(prev, cantiereId, impiantoId, allegato.id) : prev,
      );
    },
    [accessToken],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      syncStatus,
      error,
      createCantiere,
      editCantiere,
      deleteCantiere,
      createImpianto,
      editImpianto,
      deleteImpianto,
      createIntervento,
      editIntervento,
      deleteIntervento,
      uploadAllegatoCantiere,
      removeAllegatoCantiere,
      uploadAllegatoImpianto,
      removeAllegatoImpianto,
    }),
    [
      data,
      syncStatus,
      error,
      createCantiere,
      editCantiere,
      deleteCantiere,
      createImpianto,
      editImpianto,
      deleteImpianto,
      createIntervento,
      editIntervento,
      deleteIntervento,
      uploadAllegatoCantiere,
      removeAllegatoCantiere,
      uploadAllegatoImpianto,
      removeAllegatoImpianto,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useGestionaleData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useGestionaleData deve essere usato dentro DataProvider");
  return ctx;
}
