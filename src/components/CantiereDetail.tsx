import { useState } from "react";
import { useGestionaleData } from "../context/DataContext";
import { CantiereForm } from "./CantiereForm";
import { ImpiantoForm } from "./ImpiantoForm";
import { AllegatiList } from "./AllegatiList";
import { StatusBadge } from "./StatusBadge";
import { STATO_CANTIERE_LABELS, STATO_IMPIANTO_LABELS } from "../lib/constants";

export function CantiereDetail({
  cantiereId,
  onBack,
  onOpenImpianto,
}: {
  cantiereId: string;
  onBack: () => void;
  onOpenImpianto: (impiantoId: string) => void;
}) {
  const {
    data,
    editCantiere,
    deleteCantiere,
    createImpianto,
    uploadAllegatoCantiere,
    removeAllegatoCantiere,
  } = useGestionaleData();
  const [editing, setEditing] = useState(false);
  const [addingImpianto, setAddingImpianto] = useState(false);

  const cantiere = data?.cantieri.find((c) => c.id === cantiereId);
  if (!cantiere) {
    return (
      <div>
        <button className="btn btn-ghost" onClick={onBack}>
          &larr; Torna ai cantieri
        </button>
        <p className="muted">Cantiere non trovato.</p>
      </div>
    );
  }

  return (
    <section>
      <button className="btn btn-ghost" onClick={onBack}>
        &larr; Torna ai cantieri
      </button>

      <div className="section-header">
        <div className="card-title-row">
          <h2>{cantiere.nome}</h2>
          <StatusBadge value={cantiere.stato} label={STATO_CANTIERE_LABELS[cantiere.stato]} />
        </div>
        <div className="row-actions">
          <button className="btn btn-secondary btn-small" onClick={() => setEditing((v) => !v)}>
            {editing ? "Chiudi" : "Modifica"}
          </button>
          <button
            className="btn btn-danger btn-small"
            onClick={() => {
              if (confirm(`Eliminare il cantiere "${cantiere.nome}" e tutti i suoi impianti?`)) {
                deleteCantiere(cantiere.id);
                onBack();
              }
            }}
          >
            Elimina cantiere
          </button>
        </div>
      </div>

      {editing ? (
        <div className="card">
          <CantiereForm
            initial={cantiere}
            onSubmit={(input) => {
              editCantiere(cantiere.id, input);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="card details-grid">
          <div>
            <strong>Cliente</strong>
            <p>{cantiere.cliente || "-"}</p>
          </div>
          <div>
            <strong>Indirizzo</strong>
            <p>{cantiere.indirizzo || "-"}</p>
          </div>
          <div>
            <strong>Data inizio</strong>
            <p>{cantiere.dataInizio || "-"}</p>
          </div>
          <div>
            <strong>Data fine stimata</strong>
            <p>{cantiere.dataFineStimata || "-"}</p>
          </div>
          {cantiere.note && (
            <div className="details-full">
              <strong>Note</strong>
              <p>{cantiere.note}</p>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <AllegatiList
          allegati={cantiere.allegati}
          onUpload={(file) => uploadAllegatoCantiere(cantiere.id, file)}
          onRemove={(allegato) => removeAllegatoCantiere(cantiere.id, allegato)}
        />
      </div>

      <div className="section-header">
        <h3>Impianti</h3>
        <button className="btn btn-primary btn-small" onClick={() => setAddingImpianto((v) => !v)}>
          {addingImpianto ? "Chiudi" : "Aggiungi impianto"}
        </button>
      </div>

      {addingImpianto && (
        <div className="card">
          <ImpiantoForm
            onSubmit={(input) => {
              createImpianto(cantiere.id, input);
              setAddingImpianto(false);
            }}
            onCancel={() => setAddingImpianto(false)}
          />
        </div>
      )}

      {cantiere.impianti.length === 0 ? (
        <p className="muted">Nessun impianto registrato per questo cantiere.</p>
      ) : (
        <div className="card-grid">
          {cantiere.impianti.map((i) => (
            <button
              key={i.id}
              className="card card-clickable"
              onClick={() => onOpenImpianto(i.id)}
            >
              <div className="card-title-row">
                <h4>{i.tipo}</h4>
                <StatusBadge value={i.stato} label={STATO_IMPIANTO_LABELS[i.stato]} />
              </div>
              {i.descrizione && <p className="muted small">{i.descrizione}</p>}
              <p className="muted small">{i.interventi.length} interventi</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
