import { cn } from "@/lib/utils";
import { SLA_META_PCT, TIEMPO_META_MIN } from "@/lib/constants";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import type { DiaSeg, Estado, FilaMoneda, Moneda } from "@/lib/monitor";
import { TrendPill } from "@/components/dashboard/TrendPill";

export const CHIP_ESTADO: Record<Estado, string> = {
  "Bajo meta": "bg-danger-soft text-danger-text",
  "En riesgo": "bg-warning-soft text-warning-text",
  "En meta": "bg-success-soft text-success-text",
};

const MIN = 60; // escala fija 60–100 %
const y = (sla: number) => 44 - ((Math.max(MIN, Math.min(100, sla)) - MIN) / (100 - MIN)) * 44;

/** Línea del SLA diario (días con datos), con la meta punteada. */
function Sparkline({ moneda, dias, ok }: { moneda: Moneda; dias: DiaSeg[]; ok: boolean }) {
  const conDatos = dias.filter((d) => d.sla != null);
  const n = dias.length;
  const x = (dia: number) => (n > 1 ? ((dia - 1) / (n - 1)) * 200 : 100);
  const puntos = conDatos.map((d) => `${x(d.dia).toFixed(1)},${y(d.sla!).toFixed(1)}`).join(" ");
  const bajo = conDatos.filter((d) => d.sla! < SLA_META_PCT).length;
  return (
    <svg
      viewBox="0 0 200 44"
      preserveAspectRatio="none"
      className="h-11 w-full"
      role="img"
      aria-label={`SLA diario de ${moneda}: ${conDatos.length} días, ${bajo} bajo ${SLA_META_PCT}%`}
    >
      <line
        x1="0"
        x2="200"
        y1={y(SLA_META_PCT)}
        y2={y(SLA_META_PCT)}
        className="stroke-muted-foreground/50"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      {conDatos.length > 1 ? (
        <polyline
          points={puntos}
          fill="none"
          strokeWidth={1.75}
          strokeLinejoin="round"
          className={ok ? "stroke-success" : "stroke-danger"}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        conDatos.map((d) => (
          <circle key={d.dia} cx={x(d.dia)} cy={y(d.sla!)} r={2} className={ok ? "fill-success" : "fill-danger"} />
        ))
      )}
    </svg>
  );
}

export function CurrencyCards({
  filas,
  seleccionada,
  onSeleccionar,
}: {
  filas: FilaMoneda[];
  seleccionada: Moneda | null;
  onSeleccionar: (m: Moneda) => void;
}) {
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(208px,100%),1fr))]">
      {filas.map((f) => {
        const sel = f.moneda === seleccionada;
        const sla = f.sla ?? 0;
        return (
          <button
            key={f.moneda}
            type="button"
            aria-pressed={sel}
            onClick={() => onSeleccionar(f.moneda)}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-ring",
              sel && "border-brand ring-1 ring-brand hover:border-brand",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="rounded-md bg-muted px-1.5 font-mono text-[13px] font-semibold">
                  {f.moneda}
                </span>
                <span className="truncate text-[13px] text-muted-foreground">{f.pais}</span>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-[2px] text-[11px] font-semibold", CHIP_ESTADO[f.estado])}>
                {f.estado}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <span
                className={cn(
                  "text-[26px] font-bold leading-none tracking-tight",
                  f.sla != null && sla < SLA_META_PCT && "text-danger-text",
                )}
              >
                {f.sla == null ? "—" : formatPct(sla)}
              </span>
              <TrendPill hidden={f.dSla == null} value={f.dSla ?? 0} unit="pts" goodWhen="up" />
            </div>
            <Sparkline moneda={f.moneda} dias={f.dias} ok={f.sla == null || sla >= SLA_META_PCT} />
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
              <span className="flex flex-col gap-0.5">
                Tiempo
                <span
                  className={cn(
                    "font-mono text-[13px] font-semibold text-foreground",
                    (f.tiempo ?? 0) > TIEMPO_META_MIN && "text-danger-text",
                  )}
                >
                  {f.tiempo == null ? "—" : `${formatDecimal(f.tiempo)}m`}
                </span>
              </span>
              <span className="flex flex-col gap-0.5">
                Retiros
                <span className="font-mono text-[13px] font-semibold text-foreground">
                  {formatEntero(f.seg.total)}
                </span>
              </span>
              <span className="flex flex-col gap-0.5">
                Brechas
                <span className="font-mono text-[13px] font-semibold text-foreground">
                  {formatEntero(f.seg.brechas)}
                </span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
