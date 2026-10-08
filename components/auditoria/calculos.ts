import { isExonerated } from "@/lib/utils";
import { VIP_LEVELS } from "@/lib/constants";

export type OperacionRow = {
  id: string;
  hora: string; // "HH:mm:ss"
  alias: string;
  cantidad: number;
  tiempo: number;
  cumple: boolean;
  operador: string;
  nivel: string;
  comentarioBrecha?: string;
};

export const EXONERATION_REASONS = [
  "En Revisión",
  "Problemas con la plataforma",
  "Problemas con el método de pago",
  "Falta de fondos para pagar",
] as const;

export const esMotivo = (c?: string) =>
  (EXONERATION_REASONS as readonly string[]).includes(c ?? "");

/** Filtro de nivel: "Nivel 1" agrupa todo lo que no es Nivel 2/3/4. */
export type NivelFiltro = "Todos" | "Nivel 1" | "Nivel 2" | "Nivel 3" | "Nivel 4";
export const NIVELES: NivelFiltro[] = [
  "Todos",
  "Nivel 1",
  "Nivel 2",
  "Nivel 3",
  "Nivel 4",
];

export const nivelDe = (op: OperacionRow): Exclude<NivelFiltro, "Todos"> => {
  const n = op.nivel.trim();
  return (VIP_LEVELS as readonly string[]).includes(n)
    ? (n as "Nivel 2" | "Nivel 3" | "Nivel 4")
    : "Nivel 1";
};

export const esAutopago = (op: OperacionRow) => op.operador === "Autopago";
export const esExonerado = (op: OperacionRow) => isExonerated(op.comentarioBrecha);
/** Brecha = no cumple y no exonerado (manual o Autopago). */
export const esBrecha = (op: OperacionRow) => !op.cumple && !esExonerado(op);
/** Cuenta para SLA y tiempo: manual y no exonerado. */
export const esEvaluable = (op: OperacionRow) => !esAutopago(op) && !esExonerado(op);

export function kpis(scope: OperacionRow[], nivelScope: OperacionRow[]) {
  let evaluables = 0,
    cumplidos = 0,
    tiempo = 0,
    brechas = 0,
    exoneradas = 0;
  for (const op of scope) {
    if (!op.cumple && esExonerado(op)) exoneradas++;
    if (!esEvaluable(op)) continue;
    evaluables++;
    tiempo += op.tiempo;
    if (op.cumple) cumplidos++;
    else brechas++;
  }
  const autopago = nivelScope.filter(esAutopago).length;
  return {
    total: scope.length,
    evaluables,
    cumplidos,
    sla: evaluables ? (cumplidos / evaluables) * 100 : 0,
    tiempo: evaluables ? tiempo / evaluables : 0,
    brechas,
    exoneradas,
    autopago,
    totalNivel: nivelScope.length,
    autopagoPct: nivelScope.length ? (autopago / nivelScope.length) * 100 : 0,
  };
}

export type HoraPunto = { hora: string; total: number; brecha: number; dentro: number };

/** Rango de horas que se grafica (jornada operativa). */
export const HORA_INICIO = 8;
export const HORA_FIN = 22;

/** Columnas 08–22: brecha (manual, no cumple, no exonerado) y el resto. */
export function porHora(scope: OperacionRow[]): HoraPunto[] {
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => ({
    hora: String(HORA_INICIO + i).padStart(2, "0"),
    total: 0,
    brecha: 0,
    dentro: 0,
  }));
  for (const op of scope) {
    const h = Number(op.hora.slice(0, 2));
    const p = horas[h - HORA_INICIO]; // fuera de 08–22 no se grafica
    if (!p) continue;
    p.total++;
    if (!esAutopago(op) && esBrecha(op)) p.brecha++;
    else p.dentro++;
  }
  return horas;
}

export type DesempenoRow = { nombre: string; cumplen: number; brechas: number };

/** Operadores humanos, menor proporción de brechas primero. */
export function desempeno(nivelScope: OperacionRow[]): DesempenoRow[] {
  const map = new Map<string, DesempenoRow>();
  for (const op of nivelScope) {
    if (esAutopago(op)) continue;
    const r = map.get(op.operador) ?? { nombre: op.operador, cumplen: 0, brechas: 0 };
    if (!esExonerado(op)) {
      if (op.cumple) r.cumplen++;
      else r.brechas++;
    }
    map.set(op.operador, r);
  }
  const ratio = (r: DesempenoRow) => {
    const t = r.cumplen + r.brechas;
    return t ? r.brechas / t : 0;
  };
  return [...map.values()].sort(
    (a, b) =>
      ratio(a) - ratio(b) ||
      b.cumplen + b.brechas - (a.cumplen + a.brechas) ||
      a.nombre.localeCompare(b.nombre),
  );
}

/** "Todos" primero, "Autopago" segundo y el resto en orden alfabético. */
export function contadoresOperador(nivelScope: OperacionRow[]) {
  const map = new Map<string, number>();
  for (const op of nivelScope) map.set(op.operador, (map.get(op.operador) ?? 0) + 1);
  const humanos = [...map.keys()]
    .filter((n) => n !== "Autopago")
    .sort((a, b) => a.localeCompare(b));
  return [
    { nombre: "Todos", cantidad: nivelScope.length },
    ...(map.has("Autopago")
      ? [{ nombre: "Autopago", cantidad: map.get("Autopago")! }]
      : []),
    ...humanos.map((nombre) => ({ nombre, cantidad: map.get(nombre)! })),
  ];
}

export type Pestana = "todos" | "incumplidos" | "rapidos" | "exonerados";

export const PESTANAS: { id: Pestana; label: string; color: string }[] = [
  { id: "todos", label: "Todos", color: "text-muted-foreground" },
  { id: "incumplidos", label: "Incumplidos", color: "text-danger-text" },
  { id: "rapidos", label: "Más rápidos", color: "text-success-text" },
  { id: "exonerados", label: "Exonerados", color: "text-muted-foreground" },
];

export function filasDePestana(rows: OperacionRow[], p: Pestana): OperacionRow[] {
  switch (p) {
    case "incumplidos":
      return rows.filter(esBrecha).sort((a, b) => b.tiempo - a.tiempo);
    case "rapidos":
      return rows
        .filter((op) => !esAutopago(op) && op.tiempo < 1)
        .sort((a, b) => a.tiempo - b.tiempo);
    case "exonerados":
      return rows.filter((op) => !op.cumple && esExonerado(op));
    default:
      return rows;
  }
}
