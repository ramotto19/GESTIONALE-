import { useRef, useState } from "react";
import type { Allegato } from "../types";

export function AllegatiList({
  allegati,
  onUpload,
  onRemove,
}: {
  allegati: Allegato[];
  onUpload: (file: File) => Promise<void>;
  onRemove: (allegato: Allegato) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento fallito");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove(allegato: Allegato) {
    if (!confirm(`Eliminare l'allegato "${allegato.nome}" da Drive?`)) return;
    try {
      await onRemove(allegato);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eliminazione fallita");
    }
  }

  return (
    <div className="allegati">
      <div className="allegati-header">
        <h4>Allegati</h4>
        <label className="btn btn-secondary btn-small">
          {uploading ? "Caricamento..." : "Carica file"}
          <input
            ref={inputRef}
            type="file"
            hidden
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {error && <p className="alert alert-danger small">{error}</p>}
      {allegati.length === 0 ? (
        <p className="muted small">Nessun allegato.</p>
      ) : (
        <ul className="allegati-list">
          {allegati.map((a) => (
            <li key={a.id}>
              <a href={a.webViewLink} target="_blank" rel="noreferrer">
                {a.nome}
              </a>
              <button className="btn btn-ghost btn-small" onClick={() => handleRemove(a)}>
                Elimina
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
