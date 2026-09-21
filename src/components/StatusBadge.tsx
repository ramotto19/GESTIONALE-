const TONE_BY_VALUE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pianificato: "info",
  in_corso: "warning",
  sospeso: "neutral",
  concluso: "success",
  da_installare: "info",
  in_installazione: "warning",
  attivo: "success",
  guasto: "danger",
  dismesso: "neutral",
  positivo: "success",
  negativo: "danger",
  da_verificare: "warning",
};

export function StatusBadge({ value, label }: { value: string; label: string }) {
  const tone = TONE_BY_VALUE[value] ?? "neutral";
  return <span className={`badge badge-${tone}`}>{label}</span>;
}
