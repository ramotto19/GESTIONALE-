import { useState } from "react";
import type { EsitoIntervento, Intervento } from "../types";
import { ESITO_INTERVENTO_OPTIONS } from "../lib/constants";

type InterventoInput = Omit<Intervento, "id">;

const EMPTY: InterventoInput = {
  data: new Date().toISOString().slice(0, 10),
  descrizione: "",
  tecnico: "",
  esito: "da_verificare",
  note: "",
};

export function InterventoForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Intervento;
  onSubmit: (input: InterventoInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<InterventoInput>(initial ?? EMPTY);

  function set<K extends keyof InterventoInput>(key: K, value: InterventoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.descrizione.trim()) return;
        onSubmit(form);
      }}
    >
      <div className="form-grid">
        <label>
          Data *
          <input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} required />
        </label>
        <label>
          Tecnico
          <input value={form.tecnico} onChange={(e) => set("tecnico", e.target.value)} />
        </label>
        <label>
          Esito
          <select
            value={form.esito}
            onChange={(e) => set("esito", e.target.value as EsitoIntervento)}
          >
            {ESITO_INTERVENTO_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Descrizione intervento *
        <textarea
          value={form.descrizione}
          onChange={(e) => set("descrizione", e.target.value)}
          rows={2}
          required
          autoFocus
        />
      </label>
      <label>
        Note
        <textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
        <button type="submit" className="btn btn-primary">
          {initial ? "Salva modifiche" : "Registra intervento"}
        </button>
      </div>
    </form>
  );
}
