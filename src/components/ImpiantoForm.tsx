import { useState } from "react";
import type { Impianto, StatoImpianto } from "../types";
import { STATO_IMPIANTO_OPTIONS } from "../lib/constants";

type ImpiantoInput = Omit<Impianto, "id" | "interventi" | "allegati">;

const EMPTY: ImpiantoInput = {
  tipo: "",
  descrizione: "",
  stato: "da_installare",
  dataInstallazione: "",
  note: "",
};

export function ImpiantoForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Impianto;
  onSubmit: (input: ImpiantoInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ImpiantoInput>(initial ?? EMPTY);

  function set<K extends keyof ImpiantoInput>(key: K, value: ImpiantoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.tipo.trim()) return;
        onSubmit(form);
      }}
    >
      <div className="form-grid">
        <label>
          Tipo impianto *
          <input
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value)}
            placeholder="Elettrico, idraulico, HVAC..."
            required
            autoFocus
          />
        </label>
        <label>
          Stato
          <select
            value={form.stato}
            onChange={(e) => set("stato", e.target.value as StatoImpianto)}
          >
            {STATO_IMPIANTO_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data installazione
          <input
            type="date"
            value={form.dataInstallazione}
            onChange={(e) => set("dataInstallazione", e.target.value)}
          />
        </label>
      </div>
      <label>
        Descrizione
        <textarea
          value={form.descrizione}
          onChange={(e) => set("descrizione", e.target.value)}
          rows={2}
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
          {initial ? "Salva modifiche" : "Aggiungi impianto"}
        </button>
      </div>
    </form>
  );
}
