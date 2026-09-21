import { useState } from "react";
import type { Cantiere, StatoCantiere } from "../types";
import { STATO_CANTIERE_OPTIONS } from "../lib/constants";

type CantiereInput = Omit<Cantiere, "id" | "impianti" | "allegati">;

const EMPTY: CantiereInput = {
  nome: "",
  cliente: "",
  indirizzo: "",
  dataInizio: "",
  dataFineStimata: "",
  stato: "pianificato",
  note: "",
};

export function CantiereForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Cantiere;
  onSubmit: (input: CantiereInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CantiereInput>(initial ?? EMPTY);

  function set<K extends keyof CantiereInput>(key: K, value: CantiereInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.nome.trim()) return;
        onSubmit(form);
      }}
    >
      <div className="form-grid">
        <label>
          Nome cantiere *
          <input
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Cliente
          <input value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
        </label>
        <label>
          Indirizzo
          <input value={form.indirizzo} onChange={(e) => set("indirizzo", e.target.value)} />
        </label>
        <label>
          Stato
          <select
            value={form.stato}
            onChange={(e) => set("stato", e.target.value as StatoCantiere)}
          >
            {STATO_CANTIERE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data inizio
          <input
            type="date"
            value={form.dataInizio}
            onChange={(e) => set("dataInizio", e.target.value)}
          />
        </label>
        <label>
          Data fine stimata
          <input
            type="date"
            value={form.dataFineStimata}
            onChange={(e) => set("dataFineStimata", e.target.value)}
          />
        </label>
      </div>
      <label>
        Note
        <textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={3} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
        <button type="submit" className="btn btn-primary">
          {initial ? "Salva modifiche" : "Crea cantiere"}
        </button>
      </div>
    </form>
  );
}
