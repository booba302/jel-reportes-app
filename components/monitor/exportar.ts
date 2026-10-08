import { format } from "date-fns";
import { SLA_META_PCT, TIEMPO_META_MIN } from "@/lib/constants";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import {
  delta,
  nivelCelda,
  textoFranja,
  type Estado,
  type ModeloMonitor,
} from "@/lib/monitor";
import type { DocumentoPdf, Tono } from "@/components/pdf/documento";
import { nombreMesAnio } from "@/components/reportes/fechas";
import { diaSemanaCorto, fechaCritico } from "./WorstDays";

const TONO_ESTADO: Record<Estado, Tono> = {
  "Bajo meta": "mala",
  "En riesgo": "revisar",
  "En meta": "buena",
};

/** Δ con color: verde si mejora, rojo si empeora. */
const celdaDelta = (n: number | null, unidad: string, mejoraSi: "sube" | "baja") => {
  const texto = delta(n, unidad);
  if (n == null || texto === "=") return { texto, tono: "suave" as Tono };
  const bueno = mejoraSi === "sube" ? n > 0 : n < 0;
  return { texto, tono: (bueno ? "buena" : "mala") as Tono };
};

/** Documento PDF del monitor (A4 horizontal), para la vista previa y la descarga. */
export function documentoMonitor({
  m,
  mes,
  soloVip,
  mesPrevio,
  mesPrevioLargo,
  usuario,
}: {
  m: ModeloMonitor;
  mes: string;
  soloVip: boolean;
  mesPrevio: string; // "ago"
  mesPrevioLargo: string; // "agosto"
  usuario: string;
}): DocumentoPdf {
  const p = m.previo;
  const pctAutopago = m.total.total ? (m.total.autopago / m.total.total) * 100 : 0;
  const difBajo = p ? m.bajoMeta.length - p.bajoMeta : null;
  const dias = Array.from({ length: m.diasDelMes }, (_, i) => i + 1);

  return {
    nombreArchivo: `Monitor_Regional_${mes}${soloVip ? "_VIP" : ""}.pdf`,
    orientacion: "horizontal",
    titulo: `Monitor regional · ${nombreMesAnio(mes)}`,
    subtitulo: `SLA, tiempo y cuellos de botella por moneda${soloVip ? " · Solo VIP (Nivel 2, 3 y 4)" : ""}`,
    estado: m.enCurso
      ? { texto: `Mes en curso (${m.diasConDatos} ${m.diasConDatos === 1 ? "día" : "días"})`, tono: "revisar" }
      : { texto: "Mes completo" },
    bloques: [
      {
        tipo: "cajas",
        cajas: [
          {
            label: "SLA regional",
            valor: m.sla == null ? "—" : formatPct(m.sla),
            tono: m.sla != null && m.sla < SLA_META_PCT ? "mala" : undefined,
            sub: `vs ${mesPrevio}: ${delta(p?.sla != null && m.sla != null ? m.sla - p.sla : null, "pts")} · meta ${SLA_META_PCT}%`,
          },
          {
            label: "Tiempo promedio",
            valor: m.tiempo == null ? "—" : `${formatDecimal(m.tiempo)} min`,
            tono: (m.tiempo ?? 0) > TIEMPO_META_MIN ? "mala" : undefined,
            sub: `vs ${mesPrevio}: ${delta(p?.tiempo != null && m.tiempo != null ? m.tiempo - p.tiempo : null, "min")} · meta ${TIEMPO_META_MIN} min`,
          },
          {
            label: "Retiros del mes",
            valor: formatEntero(m.total.total),
            sub: `${p?.total.total ? `vs ${mesPrevio}: ${delta(((m.total.total - p.total.total) / p.total.total) * 100, "%").replace(" %", "%")} · ` : ""}${formatPct(pctAutopago)} por Autopago`,
          },
          {
            label: "Monedas bajo meta",
            valor: `${m.bajoMeta.length} de ${m.filas.length}`,
            tono: m.bajoMeta.length ? "mala" : undefined,
            sub:
              (m.bajoMeta.length ? m.bajoMeta.join(" · ") : "Todas cumplen") +
              (difBajo == null
                ? ""
                : difBajo === 0
                  ? ` · igual que ${mesPrevio}`
                  : ` · ${difBajo > 0 ? "+" : "-"}${Math.abs(difBajo)} vs ${mesPrevio}`),
          },
        ],
      },
      {
        tipo: "tabla",
        titulo: "Estado por moneda",
        cabecera: ["Moneda", "Estado", "SLA", "Var. SLA", "Tiempo", "Var. tiempo", "Retiros", "Autopago", "Brechas", "Exonerados", "Franja crítica"],
        filas: m.filas.map((f) => [
          { texto: `${f.moneda} · ${f.pais}`, negrita: true },
          { texto: f.estado, tono: TONO_ESTADO[f.estado], negrita: true },
          {
            texto: f.sla == null ? "—" : formatPct(f.sla),
            tono: (f.sla ?? 100) < SLA_META_PCT ? "mala" : undefined,
            negrita: true,
          },
          celdaDelta(f.dSla, "pts", "sube"),
          {
            texto: f.tiempo == null ? "—" : `${formatDecimal(f.tiempo)} min`,
            tono: (f.tiempo ?? 0) > TIEMPO_META_MIN ? "mala" : undefined,
          },
          celdaDelta(f.dTiempo, "min", "baja"),
          formatEntero(f.seg.total),
          formatPct(f.pctAutopago),
          formatEntero(f.seg.brechas),
          formatEntero(f.seg.exonerados),
          textoFranja(f.franja),
        ]),
      },
      {
        tipo: "tabla",
        titulo: `SLA diario por moneda (%) · verde >= ${SLA_META_PCT}, ámbar 80–89,9, rojo < 80, gris sin datos`,
        compacta: true,
        cabecera: ["", ...dias.map(String)],
        filas: m.filas.map((f) => [
          { texto: f.moneda, negrita: true },
          ...f.dias.map((d) => ({
            texto: d.sla == null ? "" : String(Math.round(d.sla)),
            fondo: nivelCelda(d.sla),
          })),
        ]),
      },
      {
        tipo: "tabla",
        titulo: "Días críticos (menor SLA del mes)",
        cabecera: ["Moneda", "Día", "SLA", "Tiempo", "Brechas", "Evaluables"],
        vacio: "Sin días con retiros evaluables.",
        filas: m.criticos.map((d) => [
          { texto: d.moneda, negrita: true },
          diaSemanaCorto(fechaCritico(mes, d)),
          { texto: formatPct(d.sla), tono: d.sla >= 80 ? "revisar" : "mala", negrita: true },
          `${formatDecimal(d.tiempo ?? 0)} min`,
          formatEntero(d.brechas),
          formatEntero(d.evaluables),
        ]),
      },
    ],
    pie: [
      `SLA y tiempo sin Autopago ni exonerados. ${m.enCurso ? `Comparado contra los mismos ${m.diasConDatos} días de ${mesPrevioLargo}.` : `Comparado contra ${mesPrevioLargo} completo.`}`,
      `Generado por ${usuario} · ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
    ],
  };
}
