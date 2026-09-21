import type { Allegato, Cantiere, GestionaleData, Impianto, Intervento } from "../types";

export function newId(): string {
  return crypto.randomUUID();
}

export function addCantiere(data: GestionaleData, cantiere: Cantiere): GestionaleData {
  return { ...data, cantieri: [cantiere, ...data.cantieri] };
}

export function updateCantiere(
  data: GestionaleData,
  cantiereId: string,
  patch: Partial<Cantiere>,
): GestionaleData {
  return {
    ...data,
    cantieri: data.cantieri.map((c) => (c.id === cantiereId ? { ...c, ...patch } : c)),
  };
}

export function removeCantiere(data: GestionaleData, cantiereId: string): GestionaleData {
  return { ...data, cantieri: data.cantieri.filter((c) => c.id !== cantiereId) };
}

function mapCantiere(
  data: GestionaleData,
  cantiereId: string,
  fn: (c: Cantiere) => Cantiere,
): GestionaleData {
  return {
    ...data,
    cantieri: data.cantieri.map((c) => (c.id === cantiereId ? fn(c) : c)),
  };
}

export function addImpianto(
  data: GestionaleData,
  cantiereId: string,
  impianto: Impianto,
): GestionaleData {
  return mapCantiere(data, cantiereId, (c) => ({ ...c, impianti: [impianto, ...c.impianti] }));
}

export function updateImpianto(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
  patch: Partial<Impianto>,
): GestionaleData {
  return mapCantiere(data, cantiereId, (c) => ({
    ...c,
    impianti: c.impianti.map((i) => (i.id === impiantoId ? { ...i, ...patch } : i)),
  }));
}

export function removeImpianto(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
): GestionaleData {
  return mapCantiere(data, cantiereId, (c) => ({
    ...c,
    impianti: c.impianti.filter((i) => i.id !== impiantoId),
  }));
}

function mapImpianto(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
  fn: (i: Impianto) => Impianto,
): GestionaleData {
  return mapCantiere(data, cantiereId, (c) => ({
    ...c,
    impianti: c.impianti.map((i) => (i.id === impiantoId ? fn(i) : i)),
  }));
}

export function addIntervento(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
  intervento: Intervento,
): GestionaleData {
  return mapImpianto(data, cantiereId, impiantoId, (i) => ({
    ...i,
    interventi: [intervento, ...i.interventi],
  }));
}

export function updateIntervento(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
  interventoId: string,
  patch: Partial<Intervento>,
): GestionaleData {
  return mapImpianto(data, cantiereId, impiantoId, (i) => ({
    ...i,
    interventi: i.interventi.map((iv) => (iv.id === interventoId ? { ...iv, ...patch } : iv)),
  }));
}

export function removeIntervento(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
  interventoId: string,
): GestionaleData {
  return mapImpianto(data, cantiereId, impiantoId, (i) => ({
    ...i,
    interventi: i.interventi.filter((iv) => iv.id !== interventoId),
  }));
}

export function addAllegatoCantiere(
  data: GestionaleData,
  cantiereId: string,
  allegato: Allegato,
): GestionaleData {
  return mapCantiere(data, cantiereId, (c) => ({ ...c, allegati: [allegato, ...c.allegati] }));
}

export function removeAllegatoCantiere(
  data: GestionaleData,
  cantiereId: string,
  allegatoId: string,
): GestionaleData {
  return mapCantiere(data, cantiereId, (c) => ({
    ...c,
    allegati: c.allegati.filter((a) => a.id !== allegatoId),
  }));
}

export function addAllegatoImpianto(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
  allegato: Allegato,
): GestionaleData {
  return mapImpianto(data, cantiereId, impiantoId, (i) => ({
    ...i,
    allegati: [allegato, ...i.allegati],
  }));
}

export function removeAllegatoImpianto(
  data: GestionaleData,
  cantiereId: string,
  impiantoId: string,
  allegatoId: string,
): GestionaleData {
  return mapImpianto(data, cantiereId, impiantoId, (i) => ({
    ...i,
    allegati: i.allegati.filter((a) => a.id !== allegatoId),
  }));
}
