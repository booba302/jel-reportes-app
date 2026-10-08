import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEntero, formatPct } from "@/lib/format";
import { SLA_META_PCT, SLA_UMBRAL_MIN } from "@/lib/constants";
import type { Resumen } from "./useDashboardData";
import { CardHeading, cardClass } from "./CardHeading";
import { TrendPill } from "./TrendPill";

export function SlaRing({ value }: { value: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, value)) / 100) * c;
  const color =
    value < SLA_META_PCT
      ? "var(--danger)"
      : value < SLA_META_PCT + 3
        ? "var(--warning)"
        : "var(--success)";

  return (
    <svg
      width={128}
      height={128}
      viewBox="0 0 140 140"
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={`SLA de cumplimiento ${formatPct(value)}`}
    >
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="var(--track)"
        strokeWidth={14}
      />
      {len > 0 && (
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${len} ${c}`}
        />
      )}
    </svg>
  );
}

export function SlaCard({
  actual,
  anterior,
  etiquetaAnterior,
  className,
}: {
  actual: Resumen;
  anterior: Resumen;
  etiquetaAnterior: string | null;
  className?: string;
}) {
  const filas = [
    { label: "Cumplidos", value: actual.cumplidos, dot: "bg-success" },
    { label: "Incumplidos", value: actual.incumplidos, dot: "bg-danger" },
    { label: "Exonerados", value: actual.exonerados, dot: "bg-level-0" },
  ];

  return (
    <section className={cn(cardClass, "flex flex-col gap-5", className)}>
      <CardHeading
        icon={CircleCheck}
        iconClassName="text-icon-green"
        title="SLA de cumplimiento"
      />

      <div className="flex flex-wrap items-center gap-5">
        <SlaRing value={actual.sla} />
        <div className="flex min-w-0 flex-col items-start gap-2.5">
          <span className="text-[38px] font-bold leading-none tracking-tight">
            {formatPct(actual.sla)}
          </span>
          {etiquetaAnterior && (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <TrendPill
                value={actual.sla - anterior.sla}
                unit="pts"
                goodWhen="up"
              />
              vs {etiquetaAnterior}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Meta {SLA_META_PCT}% · bajo {SLA_UMBRAL_MIN} min · sin Autopago
          </span>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center gap-2.5 text-sm">
            <span className={cn("size-2 rounded-full", f.dot)} />
            <span className="text-muted-foreground">{f.label}</span>
            <span className="ml-auto font-semibold">{formatEntero(f.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
