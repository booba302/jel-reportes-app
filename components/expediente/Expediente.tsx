"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Link2,
  Star,
  TriangleAlert,
} from "lucide-react";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { capitalizar, formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { SLA_META_PCT, TIEMPO_META_MIN } from "@/lib/constants";
import { colorNota } from "@/lib/evaluacion";
import type { ExpedienteData } from "@/lib/expediente";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TrendPill, calcTrend } from "@/components/dashboard/TrendPill";
import { parseMesStr } from "@/components/reportes/fechas";
import { copiarEnlaceExpediente } from "@/components/cierre/enlaces";
import { DailyScores, MonthNotes, ScoreBreakdown, SlaByCurrency } from "./piezas";
import { DailyTable } from "./DailyTable";
import { ExportPdfDialog } from "@/components/pdf/ExportPdfDialog";
import { PdfButton } from "@/components/pdf/PdfButton";
import { documentoExpediente } from "./exportar";

export type ModoExpediente = "interno" | "publico";

function ChipMovimiento({ actual, anterior }: { actual: number; anterior: number | null }) {
  if (anterior == null) return <span className="text-brand">nuevo</span>;
  const m = anterior - actual;
  if (m === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={m > 0 ? "text-success-text" : "text-danger-text"}>
      {m > 0 ? "▲" : "▼"}
      {Math.abs(m)}
    </span>
  );
}

function Encabezado({
  data,
  interno,
  usuario,
}: {
  data: ExpedienteData;
  interno: boolean;
  usuario?: string;
}) {
  const router = useRouter();
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const nombreMes = format(parseMesStr(data.mes), "LLLL yyyy", { locale: es });
  const r = data.ranking;
  const esPrimero = interno && r?.puesto === 1;

  // Navegación circular por el ranking (solo interno).
  const nombres = r?.nombres ?? [];
  const i = nombres.findIndex((n) => n === data.operador);
  const anterior = i >= 0 && nombres.length > 1 ? nombres[(i - 1 + nombres.length) % nombres.length] : null;
  const siguiente = i >= 0 && nombres.length > 1 ? nombres[(i + 1) % nombres.length] : null;
  const ir = (op: string) =>
    router.replace(`/expediente/${encodeURIComponent(op)}?mes=${data.mes}`);

  return (
    <div className="flex flex-col gap-3">
      {interno && (
        <Link
          href={`/cierre-mensual?mes=${data.mes}`}
          className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver al cierre de {nombreMes}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={cn(
              "flex size-[60px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl font-bold text-brand",
              esPrimero && "shadow-[0_0_0_3px_var(--card),0_0_0_5px_var(--gold)]",
            )}
          >
            {data.operador.charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">
              {data.operador}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span>
                Expediente de {nombreMes} · {data.grupo}
              </span>
              {interno && r?.puesto && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-[2px] text-xs font-semibold text-foreground">
                  Puesto {r.puesto} de {r.total}{" "}
                  <ChipMovimiento actual={r.puesto} anterior={r.puestoAnterior} />
                </span>
              )}
              <span
                className={cn(
                  "rounded-full px-2 py-[2px] text-xs font-semibold",
                  data.cerrado
                    ? "bg-success-soft text-success-text"
                    : "bg-warning-soft text-warning-text",
                )}
              >
                {data.cerrado ? "Mes cerrado" : "Preliminar"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {interno && anterior && siguiente && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-lg bg-card dark:bg-card"
                aria-label={`Anterior en el ranking: ${anterior}`}
                onClick={() => ir(anterior)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="font-mono text-[13px] text-muted-foreground">
                {i + 1} de {nombres.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-lg bg-card dark:bg-card"
                aria-label={`Siguiente en el ranking: ${siguiente}`}
                onClick={() => ir(siguiente)}
              >
                <ChevronRight className="size-4" />
              </Button>
              <span aria-hidden className="mx-1 h-6 w-px bg-border" />
            </div>
          )}
          {interno && (
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-lg bg-card dark:bg-card"
              onClick={() => copiarEnlaceExpediente(data.operador, data.mes, usuario ?? "Usuario")}
            >
              <Link2 className="size-4" />
              Copiar enlace
            </Button>
          )}
          <PdfButton onClick={() => setPdfAbierto(true)} />
        </div>
      </div>

      <ExportPdfDialog
        open={pdfAbierto}
        onOpenChange={setPdfAbierto}
        titulo="Exportar expediente"
        doc={pdfAbierto ? documentoExpediente(data, { interno, usuario }) : null}
        aviso={!data.cerrado && "El mes aún no está cerrado. El PDF sale marcado como PRELIMINAR."}
      />
    </div>
  );
}

function Kpis({ data }: { data: ExpedienteData }) {
  const k = data.kpis;
  const a = data.anterior;
  const mesAnt = format(addMonths(parseMesStr(data.mes), -1), "MMM", { locale: es }).replace(".", "");
  // "vs ago · equipo 8,92" (sin "vs" si no hay mes anterior)
  const ant = (s: string) => (a ? `vs ${mesAnt} · ${s}` : s);
  const incidencias = k.inconvenientes + k.turnosIncompletos;

  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
      <KpiCard
        icon={Star}
        iconClassName="text-icon-violet"
        title="Nota del mes"
        value={formatDecimal(k.nota, 2)}
        unit="/ 10"
        valueClassName={colorNota(k.nota)}
        trend={<TrendPill hidden={!a} value={k.nota - (a?.nota ?? 0)} unit="" decimals={2} goodWhen="up" />}
        footer={ant(`equipo ${formatDecimal(data.equipo.nota, 2)}`)}
      />
      <KpiCard
        icon={CircleCheck}
        iconClassName="text-icon-green"
        title="SLA"
        value={formatPct(k.sla)}
        valueClassName={k.sla < SLA_META_PCT ? "text-danger-text" : undefined}
        trend={<TrendPill hidden={!a} value={k.sla - (a?.sla ?? 0)} unit="pts" goodWhen="up" />}
        footer={ant(`equipo ${formatPct(data.equipo.sla)}`)}
      />
      <KpiCard
        icon={Clock}
        iconClassName="text-icon-amber"
        title="Tiempo promedio"
        value={formatDecimal(k.tiempo)}
        unit="min"
        valueClassName={k.tiempo > TIEMPO_META_MIN ? "text-danger-text" : undefined}
        trend={<TrendPill hidden={!a} value={k.tiempo - (a?.tiempo ?? 0)} unit="min" goodWhen="down" />}
        footer={ant(`equipo ${formatDecimal(data.equipo.tiempo)} min`)}
      />
      <KpiCard
        icon={Banknote}
        iconClassName="text-icon-blue"
        title="Retiros gestionados"
        value={formatEntero(k.retiros)}
        trend={<TrendPill hidden={!a} value={calcTrend(k.retiros, a?.retiros ?? 0)} unit="%" goodWhen="up" />}
        footer={`${formatEntero(k.dias)} días trabajados · ${formatEntero(k.dias ? Math.round(k.retiros / k.dias) : 0)} por día`}
      />
      <KpiCard
        icon={TriangleAlert}
        iconClassName="text-warning-text"
        title="Incidencias"
        value={formatEntero(incidencias)}
        valueClassName={incidencias > 0 ? "text-warning-text" : undefined}
        trend={
          <span
            className={cn(
              "rounded-full px-2 py-[3px] text-xs font-semibold",
              incidencias > 0 ? "bg-warning-soft text-warning-text" : "bg-success-soft text-success-text",
            )}
          >
            {incidencias > 0 ? "revisar" : "ok"}
          </span>
        }
        footer={`${k.inconvenientes} ${k.inconvenientes === 1 ? "inconveniente" : "inconvenientes"} · ${k.turnosIncompletos} ${k.turnosIncompletos === 1 ? "turno incompleto" : "turnos incompletos"}`}
      />
    </div>
  );
}

/** Expediente mensual del operador. `publico` oculta puesto, flechas, Copiar enlace y Auditoría. */
export function Expediente({
  modo,
  data,
  usuario,
}: {
  modo: ModoExpediente;
  data: ExpedienteData;
  usuario?: string;
}) {
  const interno = modo === "interno";
  return (
    <div className="flex flex-col gap-4">
      <Encabezado data={data} interno={interno} usuario={usuario} />
      <Kpis data={data} />
      <div className="flex flex-wrap items-stretch gap-3.5">
        <ScoreBreakdown className="min-w-0 flex-[1.3_1_460px]" data={data} />
        <SlaByCurrency className="min-w-0 flex-[1_1_340px]" data={data} />
      </div>
      <div className="flex flex-wrap items-stretch gap-3.5">
        <DailyScores className="min-w-0 flex-[2_1_560px]" data={data} />
        <MonthNotes className="min-w-0 flex-[1_1_300px]" data={data} />
      </div>
      <DailyTable data={data} interno={interno} />
    </div>
  );
}

/** Estados sin expediente (excluido, sin datos, en revisión, inválido…). */
export function AvisoExpediente({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-14 text-center">
      <span className="text-lg font-semibold">{titulo}</span>
      <span className="max-w-md text-[13px] text-muted-foreground">{texto}</span>
    </section>
  );
}

export const nombreMesCap = (mes: string) =>
  capitalizar(format(parseMesStr(mes), "LLLL yyyy", { locale: es }));
