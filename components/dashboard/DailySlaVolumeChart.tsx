"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatEntero, formatPct } from "@/lib/format";
import { SLA_META_PCT } from "@/lib/constants";
import type { Punto } from "./useDashboardData";
import { cardClass } from "./CardHeading";

const META = SLA_META_PCT;
const SLA_MIN = 85; // el eje derecho va de 85% a 100% (ticks 85/90/95/100)

const tick = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
  fontFamily: "var(--font-mono)",
};

/** Redondea hacia arriba a `partes` pasos "lindos" para que los ticks salgan enteros. */
function niceCeil(x: number, partes: number) {
  const raw = x / partes;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const paso =
    [1, 1.5, 2, 2.5, 3, 5, 10].map((s) => s * mag).find((s) => s >= raw) ??
    10 * mag;
  return Math.ceil(paso) * partes;
}

type PlotPunto = Punto & { slaPlot: number | null };

function SlaDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: PlotPunto;
}) {
  const { cx, cy, index, payload } = props;
  if (payload?.sla == null || payload.sla >= META || cx == null || cy == null)
    return <g key={index} />;
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={4.5}
      fill="var(--danger)"
      stroke="var(--card)"
      strokeWidth={2}
    />
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PlotPunto }>;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <span className="font-mono text-muted-foreground">{p.etiqueta}</span>
      <span className={cn(p.sla != null && p.sla < META && "text-danger-text")}>
        SLA {p.sla == null ? "—" : formatPct(p.sla)}
      </span>
      <span>Retiros {formatEntero(p.volumen)}</span>
    </div>
  );
}

export function DailySlaVolumeChart({
  data,
  className,
}: {
  data: Punto[];
  className?: string;
}) {
  const maxVol = Math.max(1, ...data.map((d) => d.volumen));
  const volTop = niceCeil(maxVol * 1.8, 3); // las barras ocupan ~55% inferior
  const plot: PlotPunto[] = data.map((d) => ({
    ...d,
    slaPlot: d.sla == null ? null : Math.max(SLA_MIN + 0.3, d.sla),
  }));
  const diasBajoMeta = data.filter((d) => d.sla != null && d.sla < META).length;

  return (
    <section className={cn(cardClass, "flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">SLA y volumen diario</h2>
        <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded bg-success" />
            SLA diario
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-bar" />
            Retiros por día
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-3 rounded-sm border-t border-dashed border-danger bg-chart-zone" />
            Bajo meta {META}%
          </span>
        </div>
      </div>

      <div
        role="img"
        aria-label={`Gráfico de SLA y volumen: ${data.length} puntos, ${diasBajoMeta} bajo la meta de ${META}%`}
        className="h-[236px] w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={plot}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
            barCategoryGap="18%"
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="dia"
              tickLine={false}
              axisLine={false}
              interval={plot.length > 16 ? 3 : "preserveStartEnd"}
              tick={tick}
            />
            <YAxis
              yAxisId="vol"
              orientation="left"
              domain={[0, volTop]}
              ticks={[0, volTop / 3, (volTop * 2) / 3, volTop]}
              tickFormatter={(v: number) => formatEntero(v)}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={tick}
            />
            <YAxis
              yAxisId="sla"
              orientation="right"
              domain={[SLA_MIN, 100]}
              ticks={[85, 90, 95, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={tick}
            />

            <ReferenceArea
              yAxisId="sla"
              y1={SLA_MIN}
              y2={META}
              fill="var(--chart-zone)"
              fillOpacity={1}
              ifOverflow="hidden"
            />
            <Bar
              yAxisId="vol"
              dataKey="volumen"
              fill="var(--chart-bar)"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
              isAnimationActive={false}
            />
            <ReferenceLine
              yAxisId="sla"
              y={META}
              stroke="var(--danger)"
              strokeOpacity={0.55}
              strokeDasharray="4 4"
            />
            <Line
              yAxisId="sla"
              dataKey="slaPlot"
              type="linear"
              stroke="var(--success)"
              strokeWidth={2.5}
              connectNulls={false}
              isAnimationActive={false}
              dot={SlaDot}
              activeDot={{
                r: 4,
                fill: "var(--success)",
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />

            <Tooltip
              content={ChartTooltip}
              cursor={{ fill: "var(--muted)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
