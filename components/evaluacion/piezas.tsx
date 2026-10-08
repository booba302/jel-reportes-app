"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { formatDecimal } from "@/lib/format";
import {
  aportes,
  colorNota,
  TRAMOS_TIEMPO,
  type Evaluacion,
} from "@/lib/evaluacion";

/** Escala de 9 tramos del puntaje de tiempo; resalta el tramo actual. */
export function TimeScale({ minutos }: { minutos: number }) {
  const actual = TRAMOS_TIEMPO.findIndex((t) => minutos <= t.hasta);
  return (
    <div
      className="grid grid-cols-9 gap-1"
      role="img"
      aria-label={`Escala de tiempo: ${formatDecimal(minutos)} min cae en el tramo de ${TRAMOS_TIEMPO[actual]?.pts ?? 0} puntos`}
    >
      {TRAMOS_TIEMPO.map((t, i) => (
        <div
          key={t.label}
          className="flex flex-col items-center gap-1"
          title={
            t.hasta === Infinity
              ? `Más de 45 min → ${t.pts} pts`
              : `Hasta ${t.hasta} min → ${t.pts} pts`
          }
        >
          <span
            className={cn(
              "h-1.5 w-full rounded-full",
              i === actual ? "bg-chart-in-sla" : "bg-track",
            )}
          />
          <span
            className={cn(
              "font-mono text-[10px]",
              i === actual ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Botones 1–10 con patrón radiogroup (← → cambian el valor). */
export function RatingScale({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = `${id}-label`;

  const mover = (v: number) => {
    const n = Math.min(10, Math.max(1, v));
    onChange(n);
    refs.current[n - 1]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span id={labelId} className="text-sm font-medium">
          {label}
        </span>
        <span className={cn("font-mono text-sm", disabled && "text-muted-foreground")}>
          {value || "—"} / 10
        </span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-5 gap-1 sm:grid-cols-10"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const activo = value === n;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={activo}
              // Solo el activo (o el 1 si no hay) entra en el orden de tabulación.
              tabIndex={activo || (!value && n === 1) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(n)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  mover((value || 0) + 1);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  mover((value || 2) - 1);
                }
              }}
              className={cn(
                "h-[34px] rounded-lg border font-mono text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action disabled:cursor-not-allowed",
                activo
                  ? "border-action bg-action text-action-foreground"
                  : "border-input bg-card hover:bg-accent",
                disabled && !activo && "text-muted-foreground opacity-60",
                disabled && activo && "opacity-70",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PARTES = [
  { key: "sla", label: "SLA", color: "bg-success" },
  { key: "tiempo", label: "Tiempo", color: "bg-chart-in-sla" },
  { key: "puntualidad", label: "Puntualidad", color: "bg-eval-violet" },
  { key: "proactividad", label: "Proactividad", color: "bg-warning" },
] as const;

/** Nota final con su desglose (se actualiza en vivo). */
export function FinalScore({ ev, nota }: { ev: Evaluacion; nota: number }) {
  const a = aportes(ev);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4">
      <div className="flex items-end justify-between gap-3">
        <span className="font-semibold">Nota final</span>
        <span className="flex items-baseline gap-1">
          <span className={cn("text-[36px] font-bold leading-none", colorNota(nota))}>
            {formatDecimal(nota, 2)}
          </span>
          <span className="text-muted-foreground">/ 10</span>
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-track"
        role="img"
        aria-label={PARTES.map((p) => `${p.label} ${formatDecimal(a[p.key], 2)}`).join(", ")}
      >
        {PARTES.map((p) => (
          <span key={p.key} className={p.color} style={{ width: `${a[p.key] * 10}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        {PARTES.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-sm", p.color)} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="ml-auto font-mono font-semibold">
              {formatDecimal(a[p.key], 2)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
