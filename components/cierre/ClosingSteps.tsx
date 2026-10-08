"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, History, Loader2, Lock, LockOpen } from "lucide-react";
import { differenceInCalendarDays, format, lastDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero } from "@/lib/format";
import type { CierreMensual, ResultadoCierre, RankingFila, MetricasMes } from "@/lib/cierre";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parseMesStr } from "@/components/reportes/fechas";
import { chipFecha } from "@/components/evaluacion/PendingDaysBar";

const fechaHora = (iso: string) => format(new Date(iso), "dd/MM/yyyy HH:mm");

function Paso({
  n,
  ok,
  titulo,
  children,
}: {
  n: number;
  ok: boolean;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-[1_1_240px] gap-3 border-b border-border p-4 md:border-r md:border-b-0">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          ok ? "bg-success-soft text-success-text" : "bg-muted text-muted-foreground",
        )}
      >
        {ok ? <Check className="size-4" /> : n}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold">{titulo}</span>
        {children}
      </div>
    </div>
  );
}

function Historial({ historial }: { historial: CierreMensual["historial"] }) {
  if (historial.length === 0) return null;
  const ordenado = [...historial].sort((a, b) => b.el.localeCompare(a.el));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-brand hover:underline"
        >
          <History className="size-3.5" />
          Ver historial ({historial.length})
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <ul className="flex max-h-72 flex-col gap-2.5 overflow-y-auto">
          {ordenado.map((h, i) => (
            <li key={i} className="flex gap-2.5 text-[13px]">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  h.accion === "cierre"
                    ? "bg-success-soft text-success-text"
                    : "bg-warning-soft text-warning-text",
                )}
              >
                {h.accion === "cierre" ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
              </span>
              <div className="flex min-w-0 flex-col">
                <span>
                  <strong>{h.accion === "cierre" ? "Cerrado" : "Reabierto"}</strong> por {h.por}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{fechaHora(h.el)}</span>
                {h.motivo && (
                  <span className="text-xs italic text-muted-foreground">“{h.motivo}”</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function ClosingSteps({
  mes,
  mesActual,
  hoy,
  vivo,
  cerrado,
  documento,
  permisoReabrir,
  resumen,
  onCerrar,
  onReabrir,
}: {
  mes: string;
  mesActual: string;
  hoy: Date;
  vivo: ResultadoCierre;
  cerrado: boolean;
  documento: CierreMensual | null;
  /** null = sin permiso. */
  permisoReabrir: string | null;
  resumen: { ranking: RankingFila[]; metrics: MetricasMes };
  onCerrar: () => Promise<void>;
  onReabrir: (motivo: string) => Promise<void>;
}) {
  const [dialogo, setDialogo] = useState<null | "cerrar" | "reabrir">(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const nombreMes = format(parseMesStr(mes), "LLLL yyyy", { locale: es });
  const ultimo = lastDayOfMonth(parseMesStr(mes));
  const terminado = mes < mesActual;
  const faltan = differenceInCalendarDays(ultimo, hoy);
  const sinPendientes = vivo.diasTotales > 0 && vivo.diasPendientes.length === 0;
  const puedeCerrar = !cerrado && terminado && sinPendientes;
  const motivoNoCerrar = !terminado
    ? "Disponible cuando termine el mes."
    : vivo.diasTotales === 0
      ? "No hay evaluaciones en este mes."
      : !sinPendientes
        ? "Primero confirma las evaluaciones pendientes."
        : null;

  const ejecutar = async (accion: () => Promise<void>) => {
    setOcupado(true);
    try {
      await accion();
      setDialogo(null);
      setMotivo("");
    } finally {
      setOcupado(false);
    }
  };

  const primero = resumen.ranking[0];

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card md:flex-row md:flex-wrap">
      <Paso n={1} ok={terminado} titulo="Mes terminado">
        <span className="text-xs text-muted-foreground">
          {terminado
            ? `El mes terminó el ${format(ultimo, "d 'de' MMMM", { locale: es })}.`
            : `Termina el ${format(ultimo, "d 'de' MMMM", { locale: es })} (${
                faltan === 0 ? "hoy" : `faltan ${faltan} ${faltan === 1 ? "día" : "días"}`
              }).`}
        </span>
      </Paso>

      <Paso n={2} ok={sinPendientes} titulo="Evaluaciones confirmadas">
        <span
          className={cn(
            "text-xs",
            vivo.diasPendientes.length ? "text-warning-text" : "text-muted-foreground",
          )}
        >
          {vivo.diasTotales === 0
            ? "Aún no hay evaluaciones en este mes."
            : `${vivo.diasConfirmados} de ${vivo.diasTotales} días con todas las evaluaciones confirmadas.`}
        </span>
        {vivo.diasPendientes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {vivo.diasPendientes.map((d) => (
              <Link
                key={d.fecha}
                href={`/evaluacion-diaria?fecha=${d.fecha}`}
                className="flex h-7 items-center rounded-full border border-warning bg-card px-2.5 font-mono text-xs hover:bg-accent"
              >
                {chipFecha(d.fecha)} · {d.pendientes}
              </Link>
            ))}
          </div>
        )}
      </Paso>

      <div className="flex flex-[1_1_280px] flex-col gap-2 bg-muted p-4">
        {cerrado && documento ? (
          <>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-4 text-success-text" />
              Mes cerrado
            </span>
            <span className="text-xs text-muted-foreground">
              Cerrado
              {documento.cerradoEl && ` el ${fechaHora(documento.cerradoEl)}`}
              {documento.cerradoPor && ` por ${documento.cerradoPor}`}. El ranking y las
              métricas quedan fijos.
            </span>
            <Button
              variant="outline"
              className="w-fit gap-2 rounded-lg bg-card dark:bg-card"
              disabled={!permisoReabrir}
              title={
                permisoReabrir ??
                `Solo un administrador o ${documento.cerradoPor ?? "quien lo cerró"} (quien lo cerró) puede reabrirlo.`
              }
              onClick={() => setDialogo("reabrir")}
            >
              <LockOpen className="size-4" />
              Reabrir cierre
            </Button>
            <span className="text-xs text-muted-foreground">
              {permisoReabrir ??
                `Solo un administrador o ${documento.cerradoPor ?? "quien lo cerró"} (quien lo cerró) puede reabrirlo.`}
            </span>
          </>
        ) : (
          <>
            <Button
              className="w-fit gap-2 rounded-lg bg-action text-action-foreground hover:bg-action-hover"
              disabled={!puedeCerrar}
              onClick={() => setDialogo("cerrar")}
            >
              <Lock className="size-4" />
              Cerrar {nombreMes}
            </Button>
            {motivoNoCerrar && (
              <span className="text-xs text-muted-foreground">{motivoNoCerrar}</span>
            )}
          </>
        )}
        {documento && <Historial historial={documento.historial} />}
      </div>

      {/* Cerrar */}
      <AlertDialog open={dialogo === "cerrar"} onOpenChange={(o) => !ocupado && !o && setDialogo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar {nombreMes}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se guardará una foto del ranking y de las métricas del mes. Si después se
              reabre o corrige una evaluación diaria, este cierre no cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5 rounded-lg bg-muted p-3 text-[13px]">
            <span>
              Operadores en el ranking:{" "}
              <strong>{formatEntero(resumen.ranking.length)}</strong>
            </span>
            {primero && (
              <span>
                Operador del mes: <strong>{primero.operador}</strong> ·{" "}
                {formatDecimal(primero.notaFinalPromedio, 2)}
              </span>
            )}
            <span>
              Nota promedio del equipo:{" "}
              <strong>{formatDecimal(resumen.metrics.notaPromedio, 2)}</strong>
            </span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado}
              onClick={(e) => {
                e.preventDefault();
                ejecutar(onCerrar);
              }}
              className="gap-2 bg-action text-action-foreground hover:bg-action-hover"
            >
              {ocupado && <Loader2 className="size-4 animate-spin" />}
              Cerrar mes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reabrir */}
      <AlertDialog open={dialogo === "reabrir"} onOpenChange={(o) => !ocupado && !o && setDialogo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir el cierre de {nombreMes}?</AlertDialogTitle>
            <AlertDialogDescription>
              El ranking vuelve a ser preliminar y se recalcula con las evaluaciones
              actuales. La foto anterior queda guardada en el historial del cierre. Para que
              vuelva a contar, hay que cerrar el mes de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-reapertura">Motivo de la reapertura</Label>
            <textarea
              id="motivo-reapertura"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <span className="text-xs text-muted-foreground">
              Obligatorio. Queda registrado junto a tu nombre.
            </span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado || !motivo.trim()}
              onClick={(e) => {
                e.preventDefault();
                ejecutar(() => onReabrir(motivo.trim()));
              }}
              className="gap-2"
            >
              {ocupado && <Loader2 className="size-4 animate-spin" />}
              Reabrir cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
