"use client";

import Link from "next/link";
import { FileUser, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { SLA_META_PCT } from "@/lib/constants";
import { colorNota, fondoNota } from "@/lib/evaluacion";
import { movimiento, type RankingFila } from "@/lib/cierre";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cardClass } from "@/components/dashboard/CardHeading";
import { ChipPreliminar } from "./TopOperatorCard";

export function Movimiento({ f }: { f: RankingFila }) {
  const m = movimiento(f);
  if (m === null)
    return (
      <span title="Primer mes en el ranking" className="text-[11px] text-brand">
        nuevo
      </span>
    );
  if (m === 0)
    return (
      <span title="Mismo puesto que el mes anterior" className="text-[11px] text-muted-foreground">
        —
      </span>
    );
  const sube = m > 0;
  const n = Math.abs(m);
  return (
    <span
      title={`${sube ? "Subió" : "Bajó"} ${n} ${n === 1 ? "puesto" : "puestos"}`}
      className={cn("text-[11px] font-semibold", sube ? "text-success-text" : "text-danger-text")}
    >
      {sube ? "▲" : "▼"}
      {n}
    </span>
  );
}

function incidencias(f: RankingFila) {
  const partes = [];
  if (f.inconvenientes)
    partes.push(`${f.inconvenientes} ${f.inconvenientes === 1 ? "inconveniente" : "inconvenientes"}`);
  if (f.turnosIncompletos)
    partes.push(
      `${f.turnosIncompletos} ${f.turnosIncompletos === 1 ? "turno incompleto" : "turnos incompletos"}`,
    );
  return partes.join(" · ");
}

function Accion({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & (
  | { href: string; onClick?: never }
  | { href?: never; onClick: () => void }
)) {
  const clase =
    "inline-flex size-8 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {props.href ? (
          <Link href={props.href} aria-label={label} className={clase}>
            {children}
          </Link>
        ) : (
          <button type="button" aria-label={label} onClick={props.onClick} className={clase}>
            {children}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function RankingTable({
  ranking,
  mes,
  cerrado,
  cantidadExcluidos,
  onCopiarEnlace,
}: {
  ranking: RankingFila[];
  mes: string;
  cerrado: boolean;
  cantidadExcluidos: number;
  onCopiarEnlace: (operador: string) => void;
}) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-3 p-0")}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-[18px] pt-[18px]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold">Ranking del mes</h2>
            {!cerrado && <ChipPreliminar />}
          </div>
          <p className="text-xs text-muted-foreground">
            {cerrado
              ? "Foto guardada al cerrar el mes."
              : "Se calcula con las evaluaciones confirmadas hasta hoy y puede cambiar hasta que se cierre el mes."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" />≥ 8
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" />6–7,9
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger" />
            &lt; 6
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead>
            <tr className="border-y border-border bg-muted text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="sticky left-0 bg-muted px-3 py-2 font-medium">Operador</th>
              <th className="px-3 py-2 text-right font-medium">Días</th>
              <th className="px-3 py-2 text-right font-medium">Retiros</th>
              <th className="px-3 py-2 text-right font-medium">SLA</th>
              <th className="px-3 py-2 text-right font-medium">Tiempo</th>
              <th className="px-3 py-2 text-right font-medium">Puntual.</th>
              <th className="px-3 py-2 text-right font-medium">Proact.</th>
              <th className="px-3 py-2 font-medium">Incidencias</th>
              <th className="px-3 py-2 font-medium">Nota del mes</th>
              <th className="px-4 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  No hay evaluaciones en este mes.
                </td>
              </tr>
            ) : (
              ranking.map((f) => {
                const inc = incidencias(f);
                return (
                  <tr key={f.operador} className="h-[54px] border-b border-border last:border-b-0">
                    <td className="px-4">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono font-bold">{f.puesto}</span>
                        <Movimiento f={f} />
                      </span>
                    </td>
                    <td className="sticky left-0 bg-card px-3">
                      <span className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {f.operador.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold">{f.operador}</span>
                      </span>
                    </td>
                    <td className="px-3 text-right font-mono">{formatEntero(f.diasTrabajados)}</td>
                    <td className="px-3 text-right font-mono">{formatEntero(f.totalRetiros)}</td>
                    <td
                      className={cn(
                        "px-3 text-right font-mono",
                        f.slaPromedio < SLA_META_PCT && "text-danger-text",
                      )}
                    >
                      {formatPct(f.slaPromedio)}
                    </td>
                    <td className="whitespace-nowrap px-3 text-right font-mono">
                      {formatDecimal(f.tiempoPromedio)}
                      <span className="text-muted-foreground"> min</span>
                    </td>
                    <td className="px-3 text-right font-mono">
                      {formatDecimal(f.puntualidadPromedio)}
                    </td>
                    <td className="px-3 text-right font-mono">
                      {formatDecimal(f.proactividadPromedio)}
                    </td>
                    <td className={cn("px-3 text-xs", inc ? "text-warning-text" : "text-muted-foreground")}>
                      {inc || "Sin incidencias"}
                    </td>
                    <td className="px-3">
                      <span className="flex items-center gap-2.5">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-track">
                          <span
                            className={cn("block h-full rounded-full", fondoNota(f.notaFinalPromedio))}
                            style={{ width: `${f.notaFinalPromedio * 10}%` }}
                          />
                        </span>
                        <span className={cn("font-mono font-bold", colorNota(f.notaFinalPromedio))}>
                          {formatDecimal(f.notaFinalPromedio, 2)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4">
                      <span className="flex justify-end gap-1.5">
                        <Accion
                          label={`Ver expediente de ${f.operador}`}
                          href={`/expediente/${encodeURIComponent(f.operador)}?mes=${mes}`}
                        >
                          <FileUser className="size-4" />
                        </Accion>
                        <Accion
                          label={`Copiar enlace del expediente de ${f.operador}`}
                          onClick={() => onCopiarEnlace(f.operador)}
                        >
                          <Link2 className="size-4" />
                        </Accion>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-[18px] py-3 text-xs text-muted-foreground">
        Nota del mes = promedio de las notas diarias confirmadas. SLA y tiempo ponderados por
        retiros, sin Autopago ni exonerados. ▲▼ = puestos ganados o perdidos frente al mes
        anterior.
        {cantidadExcluidos > 0 &&
          ` No incluye a ${cantidadExcluidos === 1 ? "la persona" : `los ${cantidadExcluidos} nombres`} de la lista de excluidos de la evaluación diaria.`}
      </p>
    </section>
  );
}
