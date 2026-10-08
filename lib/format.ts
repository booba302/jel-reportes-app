const NF = "es-CL";

export const formatEntero = (n: number) => Math.round(n).toLocaleString(NF); // 4.412

export const formatDecimal = (n: number, d = 1) =>
  n.toLocaleString(NF, { minimumFractionDigits: d, maximumFractionDigits: d }); // 18,4

export const formatPct = (n: number) => `${formatDecimal(n)}%`; // 94,2%

const SIMBOLO: Record<string, string> = {
  CLP: "$",
  PEN: "S/ ",
  MXN: "MX$",
  USD: "US$",
  VES: "Bs. ",
};

export function formatMontoCompacto(monto: number, moneda: string) {
  if (moneda === "GLOBAL") return "Múltiple";
  const s = SIMBOLO[moneda] ?? "";
  if (monto >= 1e9) return `${s}${formatDecimal(monto / 1e9)}B`; // $1,2B
  if (monto >= 1e6) return `${s}${formatDecimal(monto / 1e6)}M`; // $412,8M
  if (monto >= 1e3) return `${s}${formatDecimal(monto / 1e3)}K`; // US$286,3K
  return `${s}${formatEntero(monto)}`;
}

/** Monto completo con símbolo, para el `title` (tooltip nativo) del valor compacto. */
export const formatMontoCompleto = (monto: number, moneda: string) =>
  `${SIMBOLO[moneda] ?? ""}${formatMontoExacto(monto)}`;

/** Monto exacto sin abreviar ni símbolo, para copiar: 412.834.567,5 → "412.834.567,50". */
export const formatMontoExacto = (monto: number) => {
  const centavos = Math.round(monto * 100); // evita errores de punto flotante
  return (centavos / 100).toLocaleString(NF, {
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

/** "octubre" → "Octubre" */
export const capitalizar = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1);
