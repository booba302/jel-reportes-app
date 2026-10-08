"use client";

import {
  Bar,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { capitalizar, formatDecimal, formatPct } from "@/lib/format";
import { cardClass } from "@/components/dashboard/CardHeading";
import { parseMesStr } from "@/components/reportes/fechas";
import type { VistaMes } from "./useCierreMes";

type Punto = {
  mes: string;
  etiqueta: string;
  nota: number | null;
  sla: number | null;
  /** SLA acotado al eje (70–100) para que la línea no se recorte. */
  slaPlot: number | null;
  enCurso: boolean;
};

function Tick(props: {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
  datos: Punto[];
}) {
  const { x = 0, y = 0, payload, datos } = props;
  const p = datos[payload?.index ?? 0];
  if (!p) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        textAnchor="middle"
        dy={12}
        fontSize={12}
        fill="var(--muted-foreground)"
      >
        {p.etiqueta}
      </text>
      <text
        textAnchor="middle"
        dy={28}
        fontSize={11}
        fontFamily="var(--font-mono)"
        fill="var(--success-text)"
      >
        {p.sla != null ? formatPct(p.sla) : "—"}
      </text>
    </g>
  );
}

export function TeamTrend({
  meses,
  mesActual,
  className,
}: {
  meses: VistaMes[];
  mesActual: string;
  className?: string;
}) {
  const datos: Punto[] = meses.map((v, i) => {
    const d = parseMesStr(v.mes);
    const tieneDatos = v.ranking.length > 0;
    return {
      mes: v.mes,
      etiqueta: capitalizar(
        format(d, i === 0 || v.mes.endsWith("-01") ? "MMM yy" : "MMM", { locale: es }),
      ).replace(".", ""),
      nota: tieneDatos ? v.metrics.notaPromedio : null,
      sla: tieneDatos ? v.metrics.slaGlobal : null,
      slaPlot: tieneDatos ? Math.max(70.5, Math.min(100, v.metrics.slaGlobal)) : null,
      enCurso: v.mes === mesActual,
    };
  });

  return (
    <section className={cn(cardClass, "flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Tendencia del equipo · 6 meses</h2>
        <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-in-sla" />
            Nota promedio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded bg-success" />
            SLA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-chart-in-sla" />
            Mes en curso
          </span>
        </div>
      </div>

      <div
        role="img"
        aria-label={`Nota promedio y SLA de los últimos 6 meses: ${datos
          .map((p) => `${p.etiqueta} nota ${p.nota != null ? formatDecimal(p.nota, 2) : "sin datos"}`)
          .join(", ")}`}
        className="h-[230px] w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={datos} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="mes"
              interval={0}
              tickLine={false}
              axisLine={false}
              height={40}
              tick={<Tick datos={datos} />}
            />
            <YAxis yAxisId="nota" domain={[0, 10]} hide />
            <YAxis yAxisId="sla" domain={[70, 100]} hide />
            <Bar yAxisId="nota" dataKey="nota" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {datos.map((p) => (
                <Cell
                  key={p.mes}
                  fill={p.enCurso ? "transparent" : "var(--chart-in-sla)"}
                  stroke={p.enCurso ? "var(--chart-in-sla)" : undefined}
                  strokeWidth={p.enCurso ? 1.5 : 0}
                  strokeDasharray={p.enCurso ? "4 3" : undefined}
                />
              ))}
              <LabelList
                dataKey="nota"
                position="top"
                formatter={(v: unknown) => (typeof v === "number" ? formatDecimal(v, 2) : "")}
                style={{ fontSize: 12, fontFamily: "var(--font-mono)", fill: "var(--foreground)" }}
              />
            </Bar>
            <Line
              yAxisId="sla"
              dataKey="slaPlot"
              stroke="var(--success)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--success)", stroke: "var(--card)", strokeWidth: 1.5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
