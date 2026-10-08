"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CircleCheck, Loader2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { calcularPuntajeFinal, type Evaluacion } from "@/lib/evaluacion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cardClass } from "@/components/dashboard/CardHeading";
import type { Borrador } from "./useEvaluacionesDia";
import { useHistorialOperador } from "./useHistorialOperador";
import { EstadoChip } from "./OperatorList";
import { ScoreTrend } from "./ScoreTrend";
import { FinalScore, RatingScale, TimeScale } from "./piezas";

const GRUPO: Record<string, string> = { inter: "Internacional", nacional: "Nacional" };

function Seccion({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-semibold">{titulo}</span>
        {ayuda && <span className="text-xs text-muted-foreground">{ayuda}</span>}
      </div>
      {children}
    </div>
  );
}

export function EvaluationSheet({
  ev,
  dia,
  version,
  auditoriaHref,
  onCambio,
  onConfirmar,
  onReabrir,
  className,
}: {
  ev: Evaluacion;
  dia: string;
  /** Sube al confirmar/reabrir para refrescar la evolución. */
  version: number;
  auditoriaHref: string;
  onCambio: (patch: Borrador) => void;
  onConfirmar: (siguiente: boolean) => Promise<void>;
  onReabrir: () => Promise<void>;
  className?: string;
}) {
  const [n, setN] = useState<7 | 30>(7);
  const [ocupado, setOcupado] = useState<null | "confirmar" | "siguiente" | "reabrir">(
    null,
  );
  const { historial, cargando } = useHistorialOperador(ev.operador, dia, n, version);

  const confirmada = ev.estado === "Confirmado";
  const nota = confirmada && typeof ev.puntajeFinal === "number"
    ? ev.puntajeFinal
    : calcularPuntajeFinal(ev);
  const faltaObs = ev.tuvoInconveniente && !ev.comentarioInconveniente.trim();
  const idBase = `ev-${ev.id}`;

  const accion = async (tipo: "confirmar" | "siguiente" | "reabrir") => {
    setOcupado(tipo);
    try {
      if (tipo === "reabrir") await onReabrir();
      else await onConfirmar(tipo === "siguiente");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className={cn(cardClass, "flex flex-col gap-4", className)}>
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-brand">
            {ev.operador.charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-lg font-bold">{ev.operador}</h2>
              <EstadoChip estado={ev.estado} />
            </div>
            <span className="text-xs text-muted-foreground">
              {GRUPO[ev.grupoMoneda ?? ""] ?? "—"} · {formatEntero(ev.totalRetiros)} retiros
              gestionados
              {typeof ev.exonerados === "number" &&
                ` · ${formatEntero(ev.exonerados)} ${ev.exonerados === 1 ? "exonerado" : "exonerados"}`}
            </span>
          </div>
        </div>
        <Link
          href={auditoriaHref}
          className="flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
        >
          Ver sus retiros en la auditoría
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <ScoreTrend
        operador={ev.operador}
        n={n}
        onN={setN}
        historial={historial}
        cargando={cargando}
        dia={dia}
      />

      {/* Automáticos */}
      <Seccion
        titulo="Puntajes automáticos"
        ayuda="Calculados de los retiros del día · sin Autopago ni exonerados"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted p-3.5">
            <span className="flex justify-between text-xs text-muted-foreground">
              SLA <span>30% de la nota</span>
            </span>
            <span className="flex items-baseline justify-between">
              <span className="text-[22px] font-bold">{formatPct(ev.cumplimientoSlaPct)}</span>
              <span className="font-mono text-sm">{formatDecimal(ev.puntajeSla)} / 10</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-track">
              <span
                className="block h-full rounded-full bg-success"
                style={{ width: `${ev.puntajeSla * 10}%` }}
              />
            </span>
            <span className="text-xs text-muted-foreground">Puntaje = SLA ÷ 10</span>
          </div>
          <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted p-3.5">
            <span className="flex justify-between text-xs text-muted-foreground">
              Tiempo promedio <span>30% de la nota</span>
            </span>
            <span className="flex items-baseline justify-between">
              <span className="text-[22px] font-bold">
                {formatDecimal(ev.tiempoPromedioMin)} min
              </span>
              <span className="font-mono text-sm">{formatEntero(ev.puntajeTiempo)} / 10</span>
            </span>
            <TimeScale minutos={ev.tiempoPromedioMin} />
            <span className="text-xs text-muted-foreground">
              ≤10 min = 10 · cada 5 min resta 1 · más de 45 min = 0
            </span>
          </div>
        </div>
      </Seccion>

      {/* Cualitativos */}
      <Seccion titulo="Evaluación cualitativa">
        <RatingScale
          id={`${idBase}-puntualidad`}
          label="Puntualidad"
          value={ev.puntualidad}
          onChange={(v) => onCambio({ puntualidad: v })}
          disabled={confirmada}
        />
        <RatingScale
          id={`${idBase}-proactividad`}
          label="Proactividad"
          value={ev.proactividad}
          onChange={(v) => onCambio({ proactividad: v })}
          disabled={confirmada}
        />
      </Seccion>

      {/* Turno */}
      <Seccion titulo="Control de turno">
        <div className="flex flex-col rounded-[10px] border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border p-3.5">
            <div className="flex flex-col gap-0.5">
              <span id={`${idBase}-turno`} className="text-sm font-medium">
                Completó el turno
              </span>
              <span className="text-xs text-muted-foreground">
                Desmárcalo si salió antes o llegó tarde a su jornada.
              </span>
            </div>
            <Switch
              checked={ev.completoTurno}
              disabled={confirmada}
              aria-labelledby={`${idBase}-turno`}
              onCheckedChange={(v) => onCambio({ completoTurno: v })}
              className="data-checked:bg-success"
            />
          </div>
          <div className="flex flex-col gap-3 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span id={`${idBase}-inc`} className="text-sm font-medium">
                  Tuvo un inconveniente
                </span>
                <span className="text-xs text-muted-foreground">
                  Problemas técnicos, ausencias o cualquier evento del turno.
                </span>
              </div>
              <Switch
                checked={ev.tuvoInconveniente}
                disabled={confirmada}
                aria-labelledby={`${idBase}-inc`}
                onCheckedChange={(v) => onCambio({ tuvoInconveniente: v })}
                className="data-checked:bg-warning"
              />
            </div>
            {ev.tuvoInconveniente && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${idBase}-obs`} className="text-[13px]">
                  Observación del inconveniente
                </Label>
                <textarea
                  id={`${idBase}-obs`}
                  rows={3}
                  value={ev.comentarioInconveniente}
                  disabled={confirmada}
                  onChange={(e) => onCambio({ comentarioInconveniente: e.target.value })}
                  placeholder="Describe qué pasó y cómo afectó el turno…"
                  aria-invalid={faltaObs && !confirmada}
                  className={cn(
                    "w-full resize-y rounded-lg border bg-transparent px-2.5 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 dark:bg-input/30",
                    faltaObs && !confirmada ? "border-warning" : "border-input",
                  )}
                />
                {faltaObs && !confirmada && (
                  <span className="text-xs text-warning-text">
                    Agrega una observación para poder confirmar.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Seccion>

      <FinalScore ev={ev} nota={nota} />

      {/* Pie */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {confirmada ? (
          <>
            <span className="flex items-center gap-1.5 text-[13px] text-success-text">
              <CircleCheck className="size-4" />
              Confirmada
              {ev.confirmadoEl &&
                ` el ${format(new Date(ev.confirmadoEl), "dd/MM 'a las' HH:mm")}`}
              {ev.confirmadoPor && ` por ${ev.confirmadoPor}`}
            </span>
            <Button
              variant="outline"
              className="gap-2 rounded-lg"
              disabled={ocupado !== null}
              onClick={() => accion("reabrir")}
            >
              {ocupado === "reabrir" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Reabrir evaluación
            </Button>
          </>
        ) : (
          <>
            <span
              className={cn(
                "text-xs",
                faltaObs ? "text-warning-text" : "text-muted-foreground",
              )}
            >
              {faltaObs
                ? "Falta la observación del inconveniente."
                : "Los puntajes automáticos no se pueden editar."}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2 rounded-lg"
                disabled={faltaObs || ocupado !== null}
                onClick={() => accion("confirmar")}
              >
                {ocupado === "confirmar" && <Loader2 className="size-4 animate-spin" />}
                Confirmar
              </Button>
              <Button
                className="gap-2 rounded-lg bg-action text-action-foreground hover:bg-action-hover"
                disabled={faltaObs || ocupado !== null}
                onClick={() => accion("siguiente")}
              >
                {ocupado === "siguiente" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Confirmar y siguiente
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
