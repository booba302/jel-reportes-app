import { getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { formatEntero } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClass } from "@/components/dashboard/CardHeading";
import type { DiaInfo } from "./useReportesMes";
import { nombreMesAnio, parseDiaStr, parseMesStr } from "./fechas";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const LEYENDA = [
  { label: "Cargado", className: "bg-success" },
  { label: "Faltante", className: "bg-warning" },
  { label: "En curso", className: "bg-day-today-text" },
  { label: "No disponible", className: "bg-track" },
];

function ariaLabel(d: DiaInfo) {
  const fecha = format(parseDiaStr(d.dia), "d 'de' MMMM", { locale: es });
  switch (d.estado) {
    case "cargado":
      return `${fecha}, cargado, ${formatEntero(d.historial?.totalRegistros ?? 0)} retiros`;
    case "faltante":
      return `${fecha}, faltante`;
    case "en-curso":
      return `${fecha}, en curso, no disponible`;
    default:
      return `${fecha}, no disponible`;
  }
}

function Celda({
  d,
  seleccionado,
  onSelect,
}: {
  d: DiaInfo;
  seleccionado: boolean;
  onSelect: (dia: string) => void;
}) {
  const habilitado = d.estado === "cargado" || d.estado === "faltante";

  const estilo = seleccionado
    ? "border-foreground bg-foreground text-background"
    : {
        cargado: "border-day-loaded-border bg-day-loaded-bg text-success-text",
        faltante: "border-day-missing-border bg-day-missing-bg text-warning-text",
        "en-curso": "border-day-today-border bg-day-today-bg text-day-today-text",
        "no-disponible": "border-border bg-day-off-bg text-day-off-text",
      }[d.estado];

  const sub = seleccionado
    ? d.estado === "cargado"
      ? "text-day-selected-sub-ok"
      : "text-day-selected-sub-warn"
    : "";

  return (
    <button
      type="button"
      disabled={!habilitado}
      aria-pressed={habilitado ? seleccionado : undefined}
      aria-label={ariaLabel(d)}
      onClick={() => onSelect(d.dia)}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-start justify-between rounded-[10px] border px-1.5 py-1.5 text-left font-mono transition-shadow sm:min-h-[82px] sm:px-2.5 sm:py-[9px]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action",
        habilitado && !seleccionado && "hover:ring-2 hover:ring-input",
        !habilitado && "cursor-not-allowed",
        estilo,
      )}
    >
      <span className="text-[13px] font-semibold sm:text-sm">{d.numero}</span>
      <span className={cn("w-full truncate text-[10px] sm:text-xs", sub)}>
        {d.estado === "cargado" && formatEntero(d.historial?.totalRegistros ?? 0)}
        {d.estado === "faltante" && (
          <>
            <span className="sm:hidden">falt.</span>
            <span className="hidden sm:inline">faltante</span>
          </>
        )}
        {d.estado === "en-curso" && "en curso"}
      </span>
    </button>
  );
}

export function MonthCalendar({
  mes,
  dias,
  seleccionado,
  onSelect,
  className,
}: {
  mes: string;
  dias: DiaInfo[] | null;
  seleccionado: string | null;
  onSelect: (dia: string) => void;
  className?: string;
}) {
  // Lunes = 0
  const offset = (getDay(parseMesStr(mes)) + 6) % 7;
  const total = dias?.length ?? 0;
  const relleno = dias ? (7 - ((offset + total) % 7)) % 7 : 0;

  const disponibles = dias?.filter(
    (d) => d.estado === "cargado" || d.estado === "faltante",
  ).length;
  const cargados = dias?.filter((d) => d.estado === "cargado").length;

  return (
    <section className={cn(cardClass, "flex flex-col gap-3.5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold">{nombreMesAnio(mes)}</h2>
          {dias ? (
            <p className="text-[13px] text-muted-foreground">
              {disponibles
                ? `${cargados} de ${disponibles} días cargados`
                : "Sin días disponibles"}
            </p>
          ) : (
            <Skeleton className="mt-1 h-3.5 w-36" />
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {LEYENDA.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={cn("size-[9px] rounded-[3px]", l.className)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {SEMANA.map((s) => (
          <span key={s} className="text-center text-xs font-medium text-muted-foreground">
            {s}
          </span>
        ))}

        {!dias
          ? Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} className="min-h-14 rounded-[10px] sm:min-h-[82px]" />
            ))
          : [
              ...Array.from({ length: offset }, (_, i) => (
                <span key={`a${i}`} aria-hidden className="rounded-[10px] border border-dashed border-border" />
              )),
              ...dias.map((d) => (
                <Celda
                  key={d.dia}
                  d={d}
                  seleccionado={seleccionado === d.dia}
                  onSelect={onSelect}
                />
              )),
              ...Array.from({ length: relleno }, (_, i) => (
                <span key={`b${i}`} aria-hidden className="rounded-[10px] border border-dashed border-border" />
              )),
            ]}
      </div>

      <p className="text-xs text-muted-foreground">
        El día en curso y los días siguientes no se pueden seleccionar: su
        reporte se carga cuando la jornada cierra.
      </p>
    </section>
  );
}
