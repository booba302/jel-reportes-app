"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { capitalizar, formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { notaDe, UMBRAL_REVISAR, type Evaluacion } from "@/lib/evaluacion";
import { parseDiaStr } from "@/components/reportes/fechas";
import { ExportPdfDialog as DialogoPdf } from "@/components/pdf/ExportPdfDialog";
import { tonoNota, type DocumentoPdf } from "@/components/pdf/documento";
import { resumenDia } from "./DaySummary";

const FORMULA =
  "Nota = SLA × 30% + Tiempo × 30% + Puntualidad × 20% + Proactividad × 20%";

function documentoEvaluacion({
  evals,
  dia,
  grupo,
  usuario,
}: {
  evals: Evaluacion[];
  dia: string;
  grupo: string;
  usuario: string;
}): DocumentoPdf {
  const r = resumenDia(evals);
  const fechaLarga = capitalizar(
    format(parseDiaStr(dia), "EEEE d 'de' MMMM, yyyy", { locale: es }),
  );
  return {
    nombreArchivo: `Evaluacion_Diaria_${dia}_${grupo}.pdf`,
    titulo: "Evaluación diaria de operadores",
    subtitulo: `${fechaLarga} · Equipo ${grupo}`,
    bloques: [
      {
        tipo: "cajas",
        cajas: [
          { label: "Confirmadas", valor: `${r.confirmadas} / ${r.total}` },
          { label: "Nota promedio", valor: formatDecimal(r.promedio, 2) },
          {
            label: "Mejor nota",
            valor: r.mejor ? `${formatDecimal(r.mejor.nota, 2)} · ${r.mejor.ev.operador}` : "—",
          },
          { label: `Bajo ${UMBRAL_REVISAR}`, valor: formatEntero(r.aRevisar.length) },
        ],
      },
      {
        tipo: "tabla",
        cabecera: [
          "Operador", "Retiros", "SLA", "Tiempo", "Pts SLA", "Pts tiempo",
          "Puntual.", "Proact.", "Turno", "Nota", "Estado",
        ],
        filas: evals.map((ev) => [
          ev.operador,
          formatEntero(ev.totalRetiros),
          formatPct(ev.cumplimientoSlaPct),
          `${formatDecimal(ev.tiempoPromedioMin)} min`,
          formatDecimal(ev.puntajeSla),
          formatEntero(ev.puntajeTiempo),
          formatEntero(ev.puntualidad),
          formatEntero(ev.proactividad),
          ev.completoTurno ? "Completo" : "Incompleto",
          { texto: formatDecimal(notaDe(ev), 2), tono: tonoNota(notaDe(ev)), negrita: true },
          ev.estado === "Confirmado" ? "Confirmada" : "Pendiente",
        ]),
      },
      {
        tipo: "notas",
        titulo: "Observaciones del turno",
        vacio: "Sin inconvenientes registrados.",
        items: evals
          .filter((ev) => ev.tuvoInconveniente && ev.comentarioInconveniente.trim())
          .map((ev) => ({ etiqueta: ev.operador, texto: ev.comentarioInconveniente.trim() })),
      },
    ],
    pie: [FORMULA, `Generado por ${usuario} · ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
  };
}

export function ExportPdfDialog({
  open,
  onOpenChange,
  evals,
  dia,
  grupo,
  usuario,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  evals: Evaluacion[];
  dia: string;
  grupo: string;
  usuario: string;
}) {
  const pendientes = evals.filter((ev) => ev.estado !== "Confirmado").length;
  return (
    <DialogoPdf
      open={open}
      onOpenChange={onOpenChange}
      titulo="Exportar evaluación del día"
      doc={open && evals.length > 0 ? documentoEvaluacion({ evals, dia, grupo, usuario }) : null}
      aviso={
        pendientes > 0 &&
        `Hay ${pendientes} ${pendientes === 1 ? "evaluación pendiente" : "evaluaciones pendientes"}. El PDF las incluye marcadas como “Pendiente” con sus valores actuales.`
      }
    />
  );
}
