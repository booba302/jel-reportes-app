import { cn } from "@/lib/utils";
import { formatEntero, formatPct } from "@/lib/format";
import type { NivelKey, NivelRow } from "./useDashboardData";
import { cardClass } from "./CardHeading";

const COLOR: Record<NivelKey, string> = {
  Estándar: "bg-level-0",
  "Nivel 2": "bg-level-1",
  "Nivel 3": "bg-level-2",
  "Nivel 4": "bg-level-3",
};

// "Estándar" es el Nivel 1; el resto ya viene como "Nivel N".
const etiqueta = (n: NivelKey) => (n === "Estándar" ? "Nivel 1" : n);

export function VipDistributionCard({
  niveles,
  soloVip,
  className,
}: {
  niveles: NivelRow[];
  soloVip: boolean;
  className?: string;
}) {
  const total = niveles.reduce((s, n) => s + n.cantidad, 0);
  const vipTotal = niveles
    .filter((n) => n.nivel !== "Estándar")
    .reduce((s, n) => s + n.cantidad, 0);

  const filas = soloVip ? niveles.filter((n) => n.nivel !== "Estándar") : niveles;
  const base = soloVip ? vipTotal : total;
  const pct = (n: number) => (base ? (n / base) * 100 : 0);

  return (
    <section className={cn(cardClass, "flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">
          Distribución por usuarios VIP
        </h2>
        <p className="text-xs text-muted-foreground">
          {soloVip
            ? "Reparto entre niveles VIP"
            : "Participación sobre el total de retiros"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[26px] font-semibold leading-none">
          {soloVip
            ? formatEntero(vipTotal)
            : formatPct(total ? (vipTotal / total) * 100 : 0)}
        </span>
        <span className="text-xs text-muted-foreground">
          {soloVip
            ? "retiros VIP en el período"
            : `de los retiros son de usuarios VIP (${formatEntero(vipTotal)})`}
        </span>
      </div>

      <div
        className="flex h-3 gap-[3px]"
        role="img"
        aria-label={filas
          .map((f) => `${etiqueta(f.nivel)} ${formatPct(pct(f.cantidad))}`)
          .join(", ")}
      >
        {base === 0 ? (
          <span className="flex-1 rounded-[3px] bg-track" />
        ) : (
          filas
            .filter((f) => f.cantidad > 0)
            .map((f) => (
              <span
                key={f.nivel}
                className={cn("rounded-[3px]", COLOR[f.nivel])}
                style={{ width: `${pct(f.cantidad)}%` }}
              />
            ))
        )}
      </div>

      <div className="flex flex-col">
        {filas.map((f) => (
          <div
            key={f.nivel}
            className="flex items-center gap-2.5 border-b border-border py-2.5 text-sm last:border-b-0"
          >
            <span className={cn("size-2.5 rounded-[3px]", COLOR[f.nivel])} />
            <span>{etiqueta(f.nivel)}</span>
            <span className="ml-auto font-mono text-muted-foreground">
              {formatEntero(f.cantidad)}
            </span>
            <span className="min-w-[52px] text-right font-mono font-semibold">
              {formatPct(pct(f.cantidad))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
