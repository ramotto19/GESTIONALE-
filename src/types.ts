export type StatoCantiere = "pianificato" | "in_corso" | "sospeso" | "concluso";

export type StatoImpianto = "da_installare" | "in_installazione" | "attivo" | "guasto" | "dismesso";

export type EsitoIntervento = "positivo" | "negativo" | "da_verificare";

export interface Allegato {
  id: string;
  driveFileId: string;
  nome: string;
  mimeType: string;
  webViewLink: string;
  caricatoIl: string;
}

export interface Intervento {
  id: string;
  data: string;
  descrizione: string;
  tecnico: string;
  esito: EsitoIntervento;
  note: string;
}

export interface Impianto {
  id: string;
  tipo: string;
  descrizione: string;
  stato: StatoImpianto;
  dataInstallazione: string;
  note: string;
  interventi: Intervento[];
  allegati: Allegato[];
}

export interface Cantiere {
  id: string;
  nome: string;
  cliente: string;
  indirizzo: string;
  dataInizio: string;
  dataFineStimata: string;
  stato: StatoCantiere;
  note: string;
  impianti: Impianto[];
  allegati: Allegato[];
}

export interface GestionaleData {
  version: 1;
  cantieri: Cantiere[];
}

export const emptyData: GestionaleData = {
  version: 1,
  cantieri: [],
};
