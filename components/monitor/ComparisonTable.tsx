import { cn } from "@/lib/utils";
import { SLA_META_PCT, TIEMPO_META_MIN } from "@/lib/constants";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { delta, textoFranja, type ModeloMonitor, type Moneda } from "@/lib/monitor";
import { cardClass } from "@/components/dashboard/CardHeading";

/** Δ coloreado: verde si mejora, rojo si empeora, "=" neutro. */
function Delta({ n, unidad, mejoraSi }: { n: number | null; unidad: string; mejoraSi: "sube" | "baja" }) {
  const txt = delta(n, unidad);
  const neutro = n == null || txt === "=";
  const bueno = n != null && (mejoraSi === "sube" ? n > 0 : n < 0);
  return (
    <span
      className={cn(
        "font-mono",
        neutro ? "text-muted-foreground" : bueno ? "text-success-text" : "text-danger-text",
      )}
    >
      {txt}
    </span>
  );
}

const th = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground";
const td = "px-3 font-mono text-[13px]";

export function ComparisonTable({
  m,
  seleccionada,
  textoComparacion,
}: {
  m: ModeloMonitor;
  seleccionada: Moneda | null;
  /** "variación contra agosto" o "… contra los mismos 6 días de septiembre". */
  textoComparacion: string;
}) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-3.5")}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">Comparativo por moneda</h2>
        <p className="text-[13px] text-muted-foreground">
          SLA y tiempo sin Autopago ni exonerados · {textoComparacion}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={th}>Moneda</th>
              <th className={th}>Retiros</th>
              <th className={th}>% del total</th>
              <th className={th}>Autopago</th>
              <th className={th}>SLA</th>
              <th className={th}>Δ SLA</th>
              <th className={th}>Tiempo</th>
              <th className={th}>Δ Tiempo</th>
              <th className={th}>Brechas</th>
              <th className={th}>Exonerados</th>
              <th className={th}>Franja crítica</th>
            </tr>
          </thead>
          <tbody>
            {m.filas.map((f) => (
              <tr
                key={f.moneda}
                className={cn("h-[46px] border-b border-border", f.moneda === seleccionada && "bg-muted")}
              >
                <td className="px-3">
                  <span className="font-mono text-[13px] font-semibold">{f.moneda}</span>{" "}
                  <span className="text-[13px] text-muted-foreground">{f.pais}</span>
                </td>
                <td className={td}>{formatEntero(f.seg.total)}</td>
                <td className={td}>{formatPct(f.pctTotal)}</td>
                <td className={td}>{formatPct(f.pctAutopago)}</td>
                <td className={cn(td, "font-bold", (f.sla ?? 100) < SLA_META_PCT && "text-danger-text")}>
                  {f.sla == null ? "—" : formatPct(f.sla)}
                </td>
                <td className={td}>
                  <Delta n={f.dSla} unidad="pts" mejoraSi="sube" />
                </td>
                <td className={cn(td, (f.tiempo ?? 0) > TIEMPO_META_MIN && "text-danger-text")}>
                  {f.tiempo == null ? "—" : `${formatDecimal(f.tiempo)} min`}
                </td>
                <td className={td}>
                  <Delta n={f.dTiempo} unidad="min" mejoraSi="baja" />
                </td>
                <td className={td}>{formatEntero(f.seg.brechas)}</td>
                <td className={cn(td, "text-muted-foreground")}>{formatEntero(f.seg.exonerados)}</td>
                <td className={td}>{textoFranja(f.franja)}</td>
              </tr>
            ))}
            <tr className="h-[46px] font-semibold">
              <td className="px-3 text-[13px]">Total</td>
              <td className={td}>{formatEntero(m.total.total)}</td>
              <td className={td}>{formatPct(100)}</td>
              <td className={td}>
                {formatPct(m.total.total ? (m.total.autopago / m.total.total) * 100 : 0)}
              </td>
              <td className={cn(td, "font-bold", (m.sla ?? 100) < SLA_META_PCT && "text-danger-text")}>
                {m.sla == null ? "—" : formatPct(m.sla)}
              </td>
              <td className={td}>
                <Delta
                  n={m.previo?.sla != null && m.sla != null ? m.sla - m.previo.sla : null}
                  unidad="pts"
                  mejoraSi="sube"
                />
              </td>
              <td className={cn(td, (m.tiempo ?? 0) > TIEMPO_META_MIN && "text-danger-text")}>
                {m.tiempo == null ? "—" : `${formatDecimal(m.tiempo)} min`}
              </td>
              <td className={td}>
                <Delta
                  n={m.previo?.tiempo != null && m.tiempo != null ? m.tiempo - m.previo.tiempo : null}
                  unidad="min"
                  mejoraSi="baja"
                />
              </td>
              <td className={td}>{formatEntero(m.total.brechas)}</td>
              <td className={cn(td, "text-muted-foreground")}>{formatEntero(m.total.exonerados)}</td>
              <td className={td}>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
