import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SLA_META_PCT, SLA_UMBRAL_MIN, TIEMPO_META_MIN } from "@/lib/constants";
import {
  capitalizar,
  formatDecimal,
  formatEntero,
  formatMontoExacto,
  formatPct,
} from "@/lib/format";
import { parseDiaStr } from "@/components/reportes/fechas";
import type { DocumentoPdf } from "@/components/pdf/documento";
import {
  HORA_FIN,
  HORA_INICIO,
  filasDePestana,
  type DesempenoRow,
  type HoraPunto,
  type kpis,
  type NivelFiltro,
  type OperacionRow,
} from "./calculos";

/** Documento PDF de la auditoría (A4 vertical), para la vista previa y la descarga. */
export function documentoAuditoria({
  fecha,
  currency,
  nivel,
  operador,
  scope,
  k,
  horas,
  desempeno,
  nota,
  usuario,
}: {
  fecha: string;
  currency: string;
  nivel: NivelFiltro;
  operador: string;
  scope: OperacionRow[];
  k: ReturnType<typeof kpis>;
  horas: HoraPunto[];
  desempeno: DesempenoRow[];
  nota: string;
  usuario: string;
}): DocumentoPdf {
  const fechaLarga = capitalizar(
    format(parseDiaStr(fecha), "EEEE d 'de' MMMM, yyyy", { locale: es }),
  );
  const filtros = [
    nivel !== "Todos" ? nivel : null,
    operador !== "Todos" ? operador : null,
  ].filter(Boolean);
  const op = operador !== "Todos" ? `_${operador.replace(/\s+/g, "_")}` : "";
  const minutos = (t: number) => `${formatDecimal(t)} min`;

  return {
    nombreArchivo: `Auditoria_Diaria_${fecha}_${currency}${op}.pdf`,
    titulo: "Auditoría diaria de retiros",
    subtitulo: `${fechaLarga} · ${currency}${filtros.length ? ` · ${filtros.join(" · ")}` : ""}`,
    bloques: [
      {
        tipo: "cajas",
        cajas: [
          {
            label: "SLA del día",
            valor: formatPct(k.sla),
            tono: k.sla < SLA_META_PCT ? "mala" : undefined,
            sub: `${formatEntero(k.cumplidos)} de ${formatEntero(k.evaluables)} bajo ${SLA_UMBRAL_MIN} min`,
          },
          {
            label: "Tiempo promedio",
            valor: minutos(k.tiempo),
            tono: k.tiempo > TIEMPO_META_MIN ? "mala" : undefined,
            sub: `Solo gestión manual · meta ${TIEMPO_META_MIN} min`,
          },
          {
            label: "Brechas",
            valor: formatEntero(k.brechas),
            tono: k.brechas ? "mala" : undefined,
            sub: `${formatEntero(k.exoneradas)} ${k.exoneradas === 1 ? "exonerada" : "exoneradas"}`,
          },
          {
            label: "Autopago",
            valor: formatPct(k.autopagoPct),
            sub: `${formatEntero(k.autopago)} de ${formatEntero(k.totalNivel)} retiros`,
          },
        ],
      },
      {
        tipo: "tabla",
        titulo: "Desempeño por operador",
        cabecera: ["Operador", "Evaluables", "Cumplen", "Brechas", "SLA"],
        vacio: "Sin gestión manual en esta selección.",
        filas: desempeno.map((f) => {
          const total = f.cumplen + f.brechas;
          const sla = total ? (f.cumplen / total) * 100 : 0;
          return [
            f.nombre,
            formatEntero(total),
            formatEntero(f.cumplen),
            f.brechas ? { texto: formatEntero(f.brechas), tono: "mala" } : "0",
            {
              texto: total ? formatPct(sla) : "—",
              tono: total && sla < SLA_META_PCT ? "mala" : undefined,
              negrita: true,
            },
          ];
        }),
      },
      {
        tipo: "tabla",
        titulo: `Retiros por hora (${String(HORA_INICIO).padStart(2, "0")}:00–${HORA_FIN}:00)`,
        cabecera: ["Hora", "Total", "Sin brecha", "Brechas"],
        vacio: "Sin retiros en la jornada.",
        filas: horas
          .filter((h) => h.total > 0)
          .map((h) => [
            `${h.hora}:00`,
            formatEntero(h.total),
            formatEntero(h.dentro),
            h.brecha ? { texto: formatEntero(h.brecha), tono: "mala" } : "0",
          ]),
      },
      {
        tipo: "tabla",
        titulo: `Retiros incumplidos (más de ${SLA_UMBRAL_MIN} min, sin exonerar)`,
        cabecera: ["Hora", "Jugador", "Nivel", "Monto", "Tiempo", "Operador"],
        vacio: "Todos los retiros cumplieron el SLA o fueron exonerados.",
        filas: filasDePestana(scope, "incumplidos").map((r) => [
          r.hora,
          r.alias,
          r.nivel,
          formatMontoExacto(r.cantidad),
          { texto: minutos(r.tiempo), tono: "mala" },
          r.operador,
        ]),
      },
      {
        tipo: "tabla",
        titulo: "Retiros exonerados",
        cabecera: ["Hora", "Jugador", "Tiempo", "Operador", "Motivo"],
        vacio: "Ningún retiro exonerado.",
        filas: filasDePestana(scope, "exonerados").map((r) => [
          r.hora,
          r.alias,
          minutos(r.tiempo),
          r.operador,
          r.comentarioBrecha?.trim() || "—",
        ]),
      },
      {
        tipo: "notas",
        titulo: "Nota del día",
        vacio: "Sin nota registrada.",
        items: nota.trim() ? [{ texto: nota.trim() }] : [],
      },
    ],
    pie: [
      `SLA: retiros manuales bajo ${SLA_UMBRAL_MIN} min, sin Autopago ni exonerados.`,
      `Generado por ${usuario} · ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
    ],
  };
}
