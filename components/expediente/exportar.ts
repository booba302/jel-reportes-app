import { format } from "date-fns";
import { es } from "date-fns/locale";
import { capitalizar, formatDecimal, formatEntero, formatPct } from "@/lib/format";
import type { ExpedienteData } from "@/lib/expediente";
import { parseDiaStr, parseMesStr } from "@/components/reportes/fechas";
import { tonoNota, type DocumentoPdf } from "@/components/pdf/documento";

/** Documento PDF del expediente (A4 vertical), para la vista previa y la descarga. */
export function documentoExpediente(
  data: ExpedienteData,
  { interno, usuario }: { interno: boolean; usuario?: string },
): DocumentoPdf {
  const nombreMes = capitalizar(format(parseMesStr(data.mes), "LLLL yyyy", { locale: es }));
  const k = data.kpis;
  const puesto =
    interno && data.ranking?.puesto ? ` · Puesto ${data.ranking.puesto} de ${data.ranking.total}` : "";
  const ahora = format(new Date(), "dd/MM/yyyy HH:mm");

  return {
    nombreArchivo: `Expediente_${data.operador.replace(/\s+/g, "_")}_${data.mes}.pdf`,
    titulo: `Expediente de ${data.operador}`,
    subtitulo: `${nombreMes} · ${data.grupo}${puesto}`,
    estado: data.cerrado ? { texto: "Mes cerrado" } : { texto: "PRELIMINAR", tono: "revisar" },
    bloques: [
      {
        tipo: "cajas",
        cajas: [
          { label: "Nota del mes", valor: formatDecimal(k.nota, 2), sub: `equipo ${formatDecimal(data.equipo.nota, 2)}`, tono: tonoNota(k.nota) },
          { label: "SLA", valor: formatPct(k.sla), sub: `equipo ${formatPct(data.equipo.sla)}` },
          { label: "Tiempo", valor: `${formatDecimal(k.tiempo)} min`, sub: `equipo ${formatDecimal(data.equipo.tiempo)} min` },
          { label: "Retiros", valor: formatEntero(k.retiros), sub: `${k.dias} días trabajados` },
          {
            label: "Incidencias",
            valor: formatEntero(k.inconvenientes + k.turnosIncompletos),
            sub: `${k.inconvenientes} inc. · ${k.turnosIncompletos} turnos`,
          },
        ],
      },
      {
        tipo: "tabla",
        titulo: "Desglose de la nota",
        cabecera: ["Criterio", "Peso", "Puntaje", "Equipo", "Aporte"],
        filas: data.desglose.map((c) => [
          c.label,
          `${Math.round(c.peso * 100)}%`,
          formatDecimal(c.puntaje),
          formatDecimal(c.equipo),
          formatDecimal(c.aporte, 2),
        ]),
      },
      {
        tipo: "texto",
        texto: `Nota del mes: ${data.desglose.map((c) => formatDecimal(c.aporte, 2)).join(" + ")} = ${formatDecimal(k.nota, 2)}`,
      },
      {
        tipo: "tabla",
        titulo: "SLA por moneda",
        cabecera: ["Moneda", "Retiros", "SLA"],
        vacio: "Sin retiros registrados en el mes.",
        filas: data.monedas.map((m) => [m.moneda, formatEntero(m.retiros), formatPct(m.sla)]),
      },
      {
        tipo: "notas",
        titulo: "Observaciones del mes",
        vacio: "Sin inconvenientes ni turnos incompletos este mes.",
        items: data.dias
          .filter((d) => d.tuvoInconveniente || !d.completoTurno)
          .map((d) => ({
            etiqueta: `${format(parseDiaStr(d.fecha), "dd/MM")} · ${!d.completoTurno ? "Turno incompleto" : "Inconveniente"}`,
            texto: d.comentario.trim() || "Sin comentario.",
          })),
      },
      {
        tipo: "tabla",
        titulo: "Evaluaciones diarias",
        cabecera: ["Fecha", "Retiros", "SLA", "Tiempo", "Puntual.", "Proact.", "Turno", "Nota"],
        vacio: "Sin evaluaciones en el mes.",
        filas: data.dias.map((d) => [
          format(parseDiaStr(d.fecha), "dd/MM EEE", { locale: es }),
          formatEntero(d.retiros),
          formatPct(d.sla),
          `${formatDecimal(d.tiempo)} min`,
          formatEntero(d.puntualidad),
          formatEntero(d.proactividad),
          !d.completoTurno ? "Incompleto" : d.tuvoInconveniente ? "Inconveniente" : "Completo",
          {
            texto: `${formatDecimal(d.nota, 2)}${d.estado === "Pendiente" ? " (pend.)" : ""}`,
            tono: tonoNota(d.nota),
            negrita: true,
          },
        ]),
      },
    ],
    pie: [
      interno
        ? `Generado por ${usuario ?? "Usuario"} · ${ahora}`
        : `Generado desde enlace compartido · ${ahora}`,
    ],
  };
}
