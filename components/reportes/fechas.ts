import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { capitalizar } from "@/lib/format";

/** Fecha local → "YYYY-MM-DD". */
export const toDiaStr = (d: Date) => format(d, "yyyy-MM-dd");

/** "YYYY-MM-DD" → Date local (sin desfase de zona horaria). */
export const parseDiaStr = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** "2026-10-03" → "2026-10-03T00:00:00.000Z" (formato de `fechaReporte`). */
export const toFechaReporte = (dia: string) => `${dia}T00:00:00.000Z`;

/** "2026-10" → Date del día 1. */
export const parseMesStr = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1);
};

export const toMesStr = (d: Date) => format(d, "yyyy-MM");

/** "Octubre 2026" */
export const nombreMesAnio = (mes: string) =>
  capitalizar(format(parseMesStr(mes), "LLLL yyyy", { locale: es }));

/** "3 oct" */
export const diaCorto = (dia: string) =>
  format(parseDiaStr(dia), "d MMM", { locale: es });

/** "24 ago 2026" */
export const diaMedio = (dia: string) =>
  format(parseDiaStr(dia), "d MMM yyyy", { locale: es });

/** "Sábado 3 de octubre" */
export const diaLargo = (dia: string) =>
  capitalizar(format(parseDiaStr(dia), "EEEE d 'de' MMMM", { locale: es }));

/** Días de atraso entre `dia` y `hoy` (ambos "YYYY-MM-DD"). */
export const diasAtraso = (dia: string, hoy: string) =>
  differenceInCalendarDays(parseDiaStr(hoy), parseDiaStr(dia));

export const textoAtraso = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
