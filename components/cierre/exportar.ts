import { format } from "date-fns";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { movimiento, type MetricasMes, type RankingFila } from "@/lib/cierre";
import { tonoNota, type DocumentoPdf } from "@/components/pdf/documento";

export type DatosExport = {
  mes: string;
  nombreMes: string; // "Septiembre 2026"
  grupo: string;
  cerrado: boolean;
  cerradoEl: string | null;
  cerradoPor: string | null;
  ranking: RankingFila[];
  metrics: MetricasMes;
  previo: MetricasMes | null;
  excluidos: string[];
  usuario: string;
};

const FORMULA =
  "Nota del mes = promedio de las notas diarias confirmadas. SLA y tiempo ponderados por retiros, sin Autopago ni exonerados.";

const textoMovimiento = (f: RankingFila) => {
  const m = movimiento(f);
  return m === null ? "nuevo" : m === 0 ? "—" : `${m > 0 ? "▲" : "▼"}${Math.abs(m)}`;
};

const sufijo = (d: DatosExport) => (d.cerrado ? "" : "_PRELIMINAR");

const variaciones = (d: DatosExport) => {
  const p = d.previo;
  const signo = (n: number, dec = 1) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${formatDecimal(Math.abs(n), dec)}`;
  return [
    {
      label: "Retiros gestionados",
      valor: formatEntero(d.metrics.totalOps),
      variacion: p && p.totalOps ? `${signo(((d.metrics.totalOps - p.totalOps) / p.totalOps) * 100)}%` : "—",
    },
    {
      label: "SLA del mes",
      valor: formatPct(d.metrics.slaGlobal),
      variacion: p ? `${signo(d.metrics.slaGlobal - p.slaGlobal)} pts` : "—",
    },
    {
      label: "Tiempo promedio",
      valor: `${formatDecimal(d.metrics.tiempoGlobal)} min`,
      variacion: p ? `${signo(d.metrics.tiempoGlobal - p.tiempoGlobal)} min` : "—",
    },
    {
      label: "Nota promedio",
      valor: formatDecimal(d.metrics.notaPromedio, 2),
      variacion: p ? signo(d.metrics.notaPromedio - p.notaPromedio, 2) : "—",
    },
  ];
};

/** Documento PDF del cierre (A4 horizontal), para la vista previa y la descarga. */
export function documentoCierre(d: DatosExport): DocumentoPdf {
  const [p1, p2, p3] = d.ranking;
  const podio = [p2, p3]
    .filter(Boolean)
    .map((f) => `${f!.puesto}.º ${f!.operador} · ${formatDecimal(f!.notaFinalPromedio, 2)}`)
    .join("     ");
  const cerradoInfo = d.cerrado
    ? `Cerrado${d.cerradoEl ? ` el ${format(new Date(d.cerradoEl), "dd/MM/yyyy HH:mm")}` : ""}${d.cerradoPor ? ` por ${d.cerradoPor}` : ""}`
    : "Cierre aún no realizado";
  return {
    nombreArchivo: `Cierre_Mensual_${d.mes}${sufijo(d)}.pdf`,
    orientacion: "horizontal",
    titulo: `Cierre mensual — ${d.nombreMes} · ${d.grupo}`,
    subtitulo: cerradoInfo,
    estado: d.cerrado ? { texto: "Mes cerrado" } : { texto: "PRELIMINAR", tono: "revisar" },
    bloques: [
      {
        tipo: "cajas",
        cajas: variaciones(d).map((v) => ({
          label: v.label,
          valor: v.valor,
          sub: `vs mes anterior: ${v.variacion}`,
        })),
      },
      ...(p1
        ? [
            {
              tipo: "texto" as const,
              negrita: true,
              texto: `${d.cerrado ? "Operador del mes" : "Primero del ranking"}: ${p1.operador} · ${formatDecimal(p1.notaFinalPromedio, 2)}`,
            },
            ...(podio ? [{ tipo: "texto" as const, tono: "suave" as const, texto: podio }] : []),
          ]
        : []),
      {
        tipo: "tabla",
        titulo: "Ranking del mes",
        cabecera: ["#", "Mov.", "Operador", "Días", "Retiros", "SLA", "Tiempo", "Puntual.", "Proact.", "Inconv.", "Turnos inc.", "Nota"],
        vacio: "Sin evaluaciones confirmadas en el mes.",
        filas: d.ranking.map((f) => [
          String(f.puesto),
          textoMovimiento(f).replace("▲", "+").replace("▼", "-"),
          f.operador,
          formatEntero(f.diasTrabajados),
          formatEntero(f.totalRetiros),
          formatPct(f.slaPromedio),
          `${formatDecimal(f.tiempoPromedio)} min`,
          formatDecimal(f.puntualidadPromedio),
          formatDecimal(f.proactividadPromedio),
          formatEntero(f.inconvenientes),
          formatEntero(f.turnosIncompletos),
          { texto: formatDecimal(f.notaFinalPromedio, 2), tono: tonoNota(f.notaFinalPromedio), negrita: true },
        ]),
      },
      ...(d.excluidos.length
        ? [{ tipo: "texto" as const, tono: "suave" as const, texto: `Excluidos: ${d.excluidos.join(", ")}` }]
        : []),
    ],
    pie: [
      FORMULA,
      `Generado por ${d.usuario} · ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
    ],
  };
}
