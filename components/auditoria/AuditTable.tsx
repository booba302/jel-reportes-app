"use client";

import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cardClass } from "@/components/dashboard/CardHeading";
import {
  PESTANAS,
  esExonerado,
  type OperacionRow,
  type Pestana,
} from "./calculos";

export const FILAS_POR_PAGINA = 12;

function Estado({ op }: { op: OperacionRow }) {
  if (op.cumple)
    return <Badge className="bg-success-soft text-success-text">Cumple</Badge>;
  if (esExonerado(op))
    return (
      <Badge className="bg-foreground/[0.08] text-muted-foreground">Exonerado</Badge>
    );
  return <Badge className="bg-danger-soft text-danger-text">Brecha</Badge>;
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2 py-[3px] text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

function Comentario({ op }: { op: OperacionRow }) {
  if (op.cumple) return <span className="text-muted-foreground">—</span>;
  if (!op.comentarioBrecha)
    return <span className="text-warning-text">Sin comentario</span>;
  return (
    <span className="block max-w-[240px] truncate" title={op.comentarioBrecha}>
      {op.comentarioBrecha}
    </span>
  );
}

/** Hasta 5 números de página alrededor de la actual. */
function ventana(actual: number, total: number) {
  const inicio = Math.max(1, Math.min(actual - 2, total - 4));
  return Array.from({ length: Math.min(5, total) }, (_, i) => inicio + i);
}

export function AuditTable({
  pestana,
  onPestana,
  contadores,
  filas,
  pagina,
  onPagina,
  onExonerar,
  className,
}: {
  pestana: Pestana;
  onPestana: (p: Pestana) => void;
  contadores: Record<Pestana, number>;
  /** Filas de la pestaña activa (ya filtradas y ordenadas). */
  filas: OperacionRow[];
  pagina: number;
  onPagina: (p: number) => void;
  onExonerar: (op: OperacionRow) => void;
  className?: string;
}) {
  const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA));
  const desde = (pagina - 1) * FILAS_POR_PAGINA;
  const visibles = filas.slice(desde, desde + FILAS_POR_PAGINA);

  return (
    <section className={cn(cardClass, "flex flex-col gap-3 p-0 pt-2", className)}>
      {/* Pestañas */}
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4">
        <div role="tablist" aria-label="Filtrar retiros" className="-mb-px flex overflow-x-auto">
          {PESTANAS.map((p) => {
            const activa = pestana === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => onPestana(p.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] transition-colors",
                  activa
                    ? "border-brand font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
                <span className={cn("font-mono text-xs", p.color)}>
                  {formatEntero(contadores[p.id])}
                </span>
              </button>
            );
          })}
        </div>
        <span className="pb-2.5 font-mono text-xs text-muted-foreground">
          {filas.length
            ? `${desde + 1}–${desde + visibles.length} de ${formatEntero(filas.length)}`
            : "0 de 0"}
        </span>
      </div>

      {/* Tabla */}
      <div role="tabpanel" className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Hora</th>
              <th className="px-3 py-2 font-medium">Usuario</th>
              <th className="px-3 py-2 font-medium">Nivel</th>
              <th className="px-3 py-2 font-medium">Operador</th>
              <th className="px-3 py-2 text-right font-medium">Tiempo</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Comentario de brecha</th>
              <th className="sticky right-0 bg-card px-4 py-2 text-center font-medium">
                Exoneración
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No hay retiros que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              visibles.map((op) => {
                const exonerado = esExonerado(op);
                const accion = exonerado
                  ? `Editar exoneración de ${op.alias}`
                  : `Registrar exoneración de ${op.alias}`;
                return (
                  <tr
                    key={op.id}
                    className="h-12 border-t border-border transition-colors hover:bg-foreground/[0.03]"
                  >
                    <td className="px-4 font-mono text-muted-foreground">
                      {op.hora.slice(0, 5)}
                    </td>
                    <td className="max-w-[180px] truncate px-3 font-semibold">{op.alias}</td>
                    <td className="px-3 text-muted-foreground">{op.nivel}</td>
                    <td className="px-3">{op.operador}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 text-right font-mono font-semibold",
                        !op.cumple && "text-danger-text",
                      )}
                    >
                      {formatDecimal(op.tiempo)} min
                    </td>
                    <td className="px-3">
                      <Estado op={op} />
                    </td>
                    <td className="px-3">
                      <Comentario op={op} />
                    </td>
                    <td className="sticky right-0 bg-card px-4 text-center">
                      {!op.cumple && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={accion}
                              onClick={() => onExonerar(op)}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-input text-brand transition-colors hover:bg-brand-soft"
                            >
                              {exonerado ? (
                                <Pencil className="size-3.5" />
                              ) : (
                                <Plus className="size-4" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{accion}</TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pie */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {pestana === "rapidos"
            ? "Retiros manuales resueltos en menos de 1 minuto."
            : "Usa el botón de la última columna para registrar o quitar una exoneración."}
        </p>
        {totalPaginas > 1 && (
          <nav aria-label="Paginación" className="flex items-center gap-1">
            <PagBtn
              aria-label="Página anterior"
              disabled={pagina <= 1}
              onClick={() => onPagina(pagina - 1)}
            >
              <ChevronLeft className="size-4" />
            </PagBtn>
            {ventana(pagina, totalPaginas).map((n) => (
              <PagBtn
                key={n}
                aria-current={n === pagina ? "page" : undefined}
                onClick={() => onPagina(n)}
                className={cn(
                  "font-mono",
                  n === pagina &&
                    "border-action bg-action text-action-foreground hover:bg-action-hover",
                )}
              >
                {n}
              </PagBtn>
            ))}
            <PagBtn
              aria-label="Página siguiente"
              disabled={pagina >= totalPaginas}
              onClick={() => onPagina(pagina + 1)}
            >
              <ChevronRight className="size-4" />
            </PagBtn>
          </nav>
        )}
      </div>
    </section>
  );
}

function PagBtn({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg border border-input text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    />
  );
}
