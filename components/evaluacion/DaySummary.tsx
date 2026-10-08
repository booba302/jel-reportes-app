import { CircleCheck, Star, Trophy, TriangleAlert } from "lucide-react";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { colorNota, notaDe, UMBRAL_REVISAR, type Evaluacion } from "@/lib/evaluacion";
import { KpiCard } from "@/components/dashboard/KpiCard";

export function resumenDia(evals: Evaluacion[]) {
  const notas = evals.map((ev) => ({ ev, nota: notaDe(ev) }));
  const confirmadas = evals.filter((ev) => ev.estado === "Confirmado").length;
  const promedio = notas.length
    ? notas.reduce((s, n) => s + n.nota, 0) / notas.length
    : 0;
  const mejor = notas.reduce<(typeof notas)[number] | null>(
    (a, b) => (!a || b.nota > a.nota ? b : a),
    null,
  );
  const aRevisar = notas.filter((n) => n.nota < UMBRAL_REVISAR);
  return { total: evals.length, confirmadas, promedio, mejor, aRevisar };
}

export function DaySummary({ evals }: { evals: Evaluacion[] }) {
  const r = resumenDia(evals);
  const pct = r.total ? (r.confirmadas / r.total) * 100 : 0;

  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
      <KpiCard
        icon={CircleCheck}
        iconClassName="text-icon-green"
        title="Progreso del día"
        value={formatEntero(r.confirmadas)}
        unit={`de ${formatEntero(r.total)} confirmadas`}
        footer={
          <span
            className="block h-1.5 overflow-hidden rounded-full bg-track"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Evaluaciones confirmadas"
          >
            <span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
          </span>
        }
      />
      <KpiCard
        icon={Star}
        iconClassName="text-icon-amber"
        title="Nota promedio del equipo"
        value={formatDecimal(r.promedio, 2)}
        valueClassName={colorNota(r.promedio)}
        footer="Incluye pendientes con sus valores actuales"
      />
      <KpiCard
        icon={Trophy}
        iconClassName="text-icon-blue"
        title="Mejor nota"
        value={r.mejor ? formatDecimal(r.mejor.nota, 2) : "—"}
        unit={r.mejor?.ev.operador}
        valueClassName="text-success-text"
        footer={
          r.mejor
            ? `SLA ${formatPct(r.mejor.ev.cumplimientoSlaPct)} · ${formatDecimal(r.mejor.ev.tiempoPromedioMin)} min`
            : "Sin evaluaciones"
        }
      />
      <KpiCard
        icon={TriangleAlert}
        iconClassName="text-danger-text"
        title="A revisar"
        value={formatEntero(r.aRevisar.length)}
        unit={`con nota bajo ${UMBRAL_REVISAR}`}
        valueClassName={r.aRevisar.length > 0 ? "text-danger-text" : undefined}
        footer={
          r.aRevisar.length
            ? r.aRevisar.map((n) => n.ev.operador).join(", ")
            : `Nadie bajo ${UMBRAL_REVISAR} hoy`
        }
      />
    </div>
  );
}
