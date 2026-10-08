import { Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDiaStr } from "@/components/reportes/fechas";
import type { PendienteDia } from "./usePendientesAnteriores";

export const chipFecha = (f: string) => format(parseDiaStr(f), "d MMM", { locale: es });

/** Franja con las evaluaciones pendientes de otros días. */
export function PendingDaysBar({
  pendientes,
  onIr,
}: {
  pendientes: PendienteDia[];
  onIr: (fecha: string) => void;
}) {
  if (pendientes.length === 0) return null;
  const total = pendientes.reduce((s, p) => s + p.cantidad, 0);

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-warning bg-warning-soft px-3.5 py-2.5">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-warning-text">
        <Clock className="size-4" />
        {total} {total === 1 ? "evaluación pendiente" : "evaluaciones pendientes"} de
        días anteriores
      </span>
      <div className="flex flex-wrap gap-1.5">
        {pendientes.map((p) => (
          <button
            key={p.fecha}
            type="button"
            onClick={() => onIr(p.fecha)}
            className="flex h-7 items-center rounded-full border border-warning bg-card px-2.5 font-mono text-xs hover:bg-accent"
          >
            {chipFecha(p.fecha)} · {p.cantidad}
          </button>
        ))}
      </div>
    </div>
  );
}
