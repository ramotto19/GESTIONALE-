import { useState } from "react";
import { useGestionaleData } from "../context/DataContext";
import { CantiereForm } from "./CantiereForm";
import { StatusBadge } from "./StatusBadge";
import { STATO_CANTIERE_LABELS } from "../lib/constants";

export function CantieriList({ onOpenCantiere }: { onOpenCantiere: (id: string) => void }) {
  const { data, createCantiere } = useGestionaleData();
  const [showForm, setShowForm] = useState(false);

  if (!data) return null;

  return (
    <section>
      <div className="section-header">
        <h2>Cantieri</h2>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Chiudi" : "Nuovo cantiere"}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <CantiereForm
            onSubmit={(input) => {
              createCantiere(input);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {data.cantieri.length === 0 ? (
        <p className="muted">Nessun cantiere ancora. Creane uno per iniziare.</p>
      ) : (
        <div className="card-grid">
          {data.cantieri.map((c) => (
            <button key={c.id} className="card card-clickable" onClick={() => onOpenCantiere(c.id)}>
              <div className="card-title-row">
                <h3>{c.nome}</h3>
                <StatusBadge value={c.stato} label={STATO_CANTIERE_LABELS[c.stato]} />
              </div>
              {c.cliente && <p className="muted small">Cliente: {c.cliente}</p>}
              {c.indirizzo && <p className="muted small">{c.indirizzo}</p>}
              <p className="muted small">{c.impianti.length} impianti</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
