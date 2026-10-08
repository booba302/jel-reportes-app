"use client";

import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { colorNota, notaDe, type Evaluacion } from "@/lib/evaluacion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cardClass } from "@/components/dashboard/CardHeading";

export type FiltroLista = "todos" | "pendientes" | "confirmadas";

export function EstadoChip({ estado }: { estado: Evaluacion["estado"] }) {
  return estado === "Confirmado" ? (
    <span className="shrink-0 rounded-full bg-success-soft px-2 py-[2px] text-[11px] font-semibold text-success-text">
      Confirmada
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-warning-soft px-2 py-[2px] text-[11px] font-semibold text-warning-text">
      Pendiente
    </span>
  );
}

export function OperatorList({
  evals,
  filtro,
  onFiltro,
  seleccionado,
  onSelect,
  vacio,
  className,
}: {
  evals: Evaluacion[];
  filtro: FiltroLista;
  onFiltro: (f: FiltroLista) => void;
  seleccionado: string | null;
  onSelect: (id: string) => void;
  /** Contenido cuando el día no tiene evaluaciones. */
  vacio: React.ReactNode;
  className?: string;
}) {
  const pendientes = evals.filter((e) => e.estado === "Pendiente");
  const confirmadas = evals.filter((e) => e.estado === "Confirmado");
  const visibles =
    filtro === "pendientes" ? pendientes : filtro === "confirmadas" ? confirmadas : evals;

  const opciones: { id: FiltroLista; label: string; n: number }[] = [
    { id: "todos", label: "Todos", n: evals.length },
    { id: "pendientes", label: "Pendientes", n: pendientes.length },
    { id: "confirmadas", label: "Confirmadas", n: confirmadas.length },
  ];

  return (
    <section className={cn(cardClass, "flex flex-col gap-3 p-3.5", className)}>
      <h2 className="sr-only">Operadores</h2>
      {evals.length === 0 ? (
        vacio
      ) : (
        <>
          <ToggleGroup
            type="single"
            value={filtro}
            onValueChange={(v) => v && onFiltro(v as FiltroLista)}
            aria-label="Filtrar operadores"
            spacing={0.5}
            className="w-full rounded-[9px] border border-border bg-muted p-[3px]"
          >
            {opciones.map((o) => (
              <ToggleGroupItem
                key={o.id}
                value={o.id}
                className="h-8 flex-1 gap-1.5 rounded-[7px] px-2 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-segment-active data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,.18),0_0_0_1px_var(--input)]"
              >
                {o.label}
                <span className="font-mono">{o.n}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {visibles.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              {filtro === "pendientes"
                ? "No quedan evaluaciones pendientes."
                : "Aún no hay evaluaciones confirmadas."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibles.map((ev) => {
                const nota = notaDe(ev);
                const activo = seleccionado === ev.id;
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      onClick={() => onSelect(ev.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[10px] border p-3 text-left transition-colors",
                        activo
                          ? "border-brand bg-brand-soft"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {ev.operador.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-semibold">{ev.operador}</span>
                          <EstadoChip estado={ev.estado} />
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          SLA {formatPct(ev.cumplimientoSlaPct)} ·{" "}
                          {formatDecimal(ev.tiempoPromedioMin)} min ·{" "}
                          {formatEntero(ev.totalRetiros)} ret.
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-[22px] font-bold", colorNota(nota))}>
                        {formatDecimal(nota)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
