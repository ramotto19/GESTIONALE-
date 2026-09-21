import type { EsitoIntervento, StatoCantiere, StatoImpianto } from "../types";

export const STATO_CANTIERE_LABELS: Record<StatoCantiere, string> = {
  pianificato: "Pianificato",
  in_corso: "In corso",
  sospeso: "Sospeso",
  concluso: "Concluso",
};

export const STATO_IMPIANTO_LABELS: Record<StatoImpianto, string> = {
  da_installare: "Da installare",
  in_installazione: "In installazione",
  attivo: "Attivo",
  guasto: "Guasto",
  dismesso: "Dismesso",
};

export const ESITO_INTERVENTO_LABELS: Record<EsitoIntervento, string> = {
  positivo: "Positivo",
  negativo: "Negativo",
  da_verificare: "Da verificare",
};

export const STATO_CANTIERE_OPTIONS = Object.entries(STATO_CANTIERE_LABELS) as [
  StatoCantiere,
  string,
][];

export const STATO_IMPIANTO_OPTIONS = Object.entries(STATO_IMPIANTO_LABELS) as [
  StatoImpianto,
  string,
][];

export const ESITO_INTERVENTO_OPTIONS = Object.entries(ESITO_INTERVENTO_LABELS) as [
  EsitoIntervento,
  string,
][];
