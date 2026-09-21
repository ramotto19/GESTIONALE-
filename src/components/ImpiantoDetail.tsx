import { useState } from "react";
import { useGestionaleData } from "../context/DataContext";
import { ImpiantoForm } from "./ImpiantoForm";
import { InterventoForm } from "./InterventoForm";
import { AllegatiList } from "./AllegatiList";
import { StatusBadge } from "./StatusBadge";
import { ESITO_INTERVENTO_LABELS, STATO_IMPIANTO_LABELS } from "../lib/constants";

export function ImpiantoDetail({
  cantiereId,
  impiantoId,
  onBack,
}: {
  cantiereId: string;
  impiantoId: string;
  onBack: () => void;
}) {
  const {
    data,
    editImpianto,
    deleteImpianto,
    createIntervento,
    deleteIntervento,
    uploadAllegatoImpianto,
    removeAllegatoImpianto,
  } = useGestionaleData();
  const [editing, setEditing] = useState(false);
  const [addingIntervento, setAddingIntervento] = useState(false);

  const cantiere = data?.cantieri.find((c) => c.id === cantiereId);
  const impianto = cantiere?.impianti.find((i) => i.id === impiantoId);

  if (!cantiere || !impianto) {
    return (
      <div>
        <button className="btn btn-ghost" onClick={onBack}>
          &larr; Torna al cantiere
        </button>
        <p className="muted">Impianto non trovato.</p>
      </div>
    );
  }

  return (
    <section>
      <button className="btn btn-ghost" onClick={onBack}>
        &larr; Torna al cantiere "{cantiere.nome}"
      </button>

      <div className="section-header">
        <div className="card-title-row">
          <h2>{impianto.tipo}</h2>
          <StatusBadge value={impianto.stato} label={STATO_IMPIANTO_LABELS[impianto.stato]} />
        </div>
        <div className="row-actions">
          <button className="btn btn-secondary btn-small" onClick={() => setEditing((v) => !v)}>
            {editing ? "Chiudi" : "Modifica"}
          </button>
          <button
            className="btn btn-danger btn-small"
            onClick={() => {
              if (confirm(`Eliminare l'impianto "${impianto.tipo}"?`)) {
                deleteImpianto(cantiere.id, impianto.id);
                onBack();
              }
            }}
          >
            Elimina impianto
          </button>
        </div>
      </div>

      {editing ? (
        <div className="card">
          <ImpiantoForm
            initial={impianto}
            onSubmit={(input) => {
              editImpianto(cantiere.id, impianto.id, input);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="card details-grid">
          <div>
            <strong>Data installazione</strong>
            <p>{impianto.dataInstallazione || "-"}</p>
          </div>
          {impianto.descrizione && (
            <div className="details-full">
              <strong>Descrizione</strong>
              <p>{impianto.descrizione}</p>
            </div>
          )}
          {impianto.note && (
            <div className="details-full">
              <strong>Note</strong>
              <p>{impianto.note}</p>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <AllegatiList
          allegati={impianto.allegati}
          onUpload={(file) => uploadAllegatoImpianto(cantiere.id, impianto.id, file)}
          onRemove={(allegato) => removeAllegatoImpianto(cantiere.id, impianto.id, allegato)}
        />
      </div>

      <div className="section-header">
        <h3>Interventi</h3>
        <button
          className="btn btn-primary btn-small"
          onClick={() => setAddingIntervento((v) => !v)}
        >
          {addingIntervento ? "Chiudi" : "Registra intervento"}
        </button>
      </div>

      {addingIntervento && (
        <div className="card">
          <InterventoForm
            onSubmit={(input) => {
              createIntervento(cantiere.id, impianto.id, input);
              setAddingIntervento(false);
            }}
            onCancel={() => setAddingIntervento(false)}
          />
        </div>
      )}

      {impianto.interventi.length === 0 ? (
        <p className="muted">Nessun intervento registrato.</p>
      ) : (
        <ul className="interventi-list">
          {impianto.interventi.map((iv) => (
            <li key={iv.id} className="card">
              <div className="card-title-row">
                <strong>{iv.data}</strong>
                <StatusBadge value={iv.esito} label={ESITO_INTERVENTO_LABELS[iv.esito]} />
              </div>
              <p>{iv.descrizione}</p>
              {iv.tecnico && <p className="muted small">Tecnico: {iv.tecnico}</p>}
              {iv.note && <p className="muted small">{iv.note}</p>}
              <div className="row-actions">
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    if (confirm("Eliminare questo intervento?")) {
                      deleteIntervento(cantiere.id, impianto.id, iv.id);
                    }
                  }}
                >
                  Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
