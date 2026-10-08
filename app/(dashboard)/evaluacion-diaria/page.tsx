"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import { subDays } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/app/context/AuthContext";
import { parseUserRole } from "@/lib/roles";
import { formatDecimal } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cardClass } from "@/components/dashboard/CardHeading";
import { toDiaStr } from "@/components/reportes/fechas";
import { EvalHeader } from "@/components/evaluacion/EvalHeader";
import { ExcludedPopover } from "@/components/evaluacion/ExcludedPopover";
import { PendingDaysBar } from "@/components/evaluacion/PendingDaysBar";
import { DaySummary } from "@/components/evaluacion/DaySummary";
import { OperatorList, type FiltroLista } from "@/components/evaluacion/OperatorList";
import { EvaluationSheet } from "@/components/evaluacion/EvaluationSheet";
import { ExportPdfDialog } from "@/components/evaluacion/ExportPdfDialog";
import { useExcluidos } from "@/components/evaluacion/useExcluidos";
import { useEvaluacionesDia } from "@/components/evaluacion/useEvaluacionesDia";
import { usePendientesAnteriores } from "@/components/evaluacion/usePendientesAnteriores";
import { sincronizarDia } from "@/components/evaluacion/sincronizar";
import type { Evaluacion } from "@/lib/evaluacion";

/** `fecha` válida y anterior a hoy; si no, ayer. */
function leerFecha(param: string | null, hoy: string, ayer: string) {
  const f = param?.split("T")[0] ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return ayer;
  const real = toDiaStr(new Date(`${f}T12:00:00`)) === f;
  return real && f < hoy ? f : ayer;
}

function auditoriaHref(ev: Evaluacion) {
  const params = new URLSearchParams({ fecha: ev.fecha.slice(0, 10) });
  const moneda = ev.moneda ?? (ev.grupoMoneda === "nacional" ? "VES" : undefined);
  if (moneda) params.set("moneda", moneda);
  params.set("operador", ev.operador);
  return `/auditoria-diaria?${params}`;
}

function EvaluacionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { userData } = useAuth();
  const rol = useMemo(() => parseUserRole(userData?.rol), [userData?.rol]);
  const usuario = userData?.nombre || "Usuario";
  const panel = rol.isAdmin ? "Administrador" : rol.isInter ? "Internacional" : "Nacional";
  const grupoPdf = rol.isAdmin ? "Global" : panel;

  const [{ hoy, ayer }] = useState(() => {
    const now = new Date();
    return { hoy: toDiaStr(now), ayer: toDiaStr(subDays(now, 1)) };
  });
  const [dia, setDia] = useState(() => leerFecha(searchParams.get("fecha"), hoy, ayer));

  useEffect(() => {
    router.replace(`${pathname}?fecha=${dia}`, { scroll: false });
  }, [dia, pathname, router]);

  const excluidos = useExcluidos(usuario);
  const listo = Boolean(userData) && !excluidos.cargando;

  const { evaluaciones, cargando, error, hayBorradores, actualizar, confirmar, reabrir, recargar } =
    useEvaluacionesDia({ dia, rol, esExcluido: excluidos.esExcluido, usuario });

  const [versionPend, setVersionPend] = useState(0);
  const { pendientes } = usePendientesAnteriores({
    rol,
    esExcluido: excluidos.esExcluido,
    listo,
    version: versionPend,
  });
  const pendientesOtrosDias = (pendientes ?? []).filter((p) => p.fecha !== dia);

  // Selección: la elegida si sigue en la lista; si no, el primer pendiente o el primero.
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroLista>("todos");
  const lista = useMemo(() => (listo ? evaluaciones ?? [] : []), [listo, evaluaciones]);
  const ev =
    lista.find((e) => e.id === seleccionado) ??
    lista.find((e) => e.estado === "Pendiente") ??
    lista[0] ??
    null;

  const [versionHist, setVersionHist] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [pdfAbierto, setPdfAbierto] = useState(false);

  // En móvil la ficha se abre como hoja a pantalla completa.
  const esMovil = useMediaQuery("(max-width: 640px)");
  const [hojaAbierta, setHojaAbierta] = useState(false);

  // Aviso al salir con cambios sin confirmar.
  useEffect(() => {
    if (!hayBorradores) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hayBorradores]);

  const cambiarDia = (d: string) => {
    setDia(d);
    setSeleccionado(null);
    setHojaAbierta(false);
  };

  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    try {
      const n = await sincronizarDia({
        dia,
        rol: userData?.rol,
        esExcluido: excluidos.esExcluido,
      });
      if (n === 0) toast.info("No se encontraron operaciones de tu grupo para esta fecha.");
      else toast.success(`Se actualizaron los puntajes automáticos de ${n} operadores`);
      recargar();
      setVersionHist((v) => v + 1);
      setVersionPend((v) => v + 1);
    } catch (err) {
      console.error("Error al sincronizar:", err);
      toast.error("Error al sincronizar datos con Firebase.");
    } finally {
      setSincronizando(false);
    }
  }, [dia, userData?.rol, excluidos.esExcluido, recargar]);

  const onConfirmar = async (siguiente: boolean) => {
    if (!ev) return;
    try {
      const nota = await confirmar(ev);
      toast.success(`Evaluación de ${ev.operador} confirmada · ${formatDecimal(nota, 2)}`);
      setVersionHist((v) => v + 1);
      setVersionPend((v) => v + 1);
      if (siguiente) {
        const i = lista.findIndex((e) => e.id === ev.id);
        const prox =
          lista.slice(i + 1).find((e) => e.estado === "Pendiente") ??
          lista.slice(0, i).find((e) => e.estado === "Pendiente");
        setSeleccionado((prox ?? ev).id);
      } else {
        setSeleccionado(ev.id);
      }
    } catch (err) {
      console.error("Error al confirmar:", err);
      toast.error("Error al confirmar la evaluación.");
    }
  };

  const onReabrir = async () => {
    if (!ev) return;
    try {
      await reabrir(ev);
      toast.success(`Evaluación de ${ev.operador} reabierta`);
      setVersionHist((v) => v + 1);
      setVersionPend((v) => v + 1);
    } catch (err) {
      console.error("Error al reabrir:", err);
      toast.error("Error al reabrir la evaluación.");
    }
  };

  const sugerencias = useMemo(
    () => lista.map((e) => e.operador).filter((n) => !excluidos.esExcluido(n)),
    [lista, excluidos],
  );

  const ficha = ev && (
    <EvaluationSheet
      key={ev.id}
      ev={ev}
      dia={dia}
      version={versionHist}
      auditoriaHref={auditoriaHref(ev)}
      onCambio={(patch) => actualizar(ev.id, patch)}
      onConfirmar={onConfirmar}
      onReabrir={onReabrir}
      className={esMovil ? "border-0 p-0" : "min-w-0 flex-[2_1_560px]"}
    />
  );

  const cargandoVista = !listo || cargando;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      <EvalHeader
        dia={dia}
        ayer={ayer}
        panel={panel}
        onDia={cambiarDia}
        sincronizando={sincronizando}
        onSincronizar={sincronizar}
        onExportar={() => setPdfAbierto(true)}
        exportarDisabled={cargandoVista || lista.length === 0}
        excluidos={
          <ExcludedPopover
            lista={excluidos.lista ?? []}
            sugerencias={sugerencias}
            agregar={excluidos.agregar}
            quitar={excluidos.quitar}
            onSincronizar={sincronizar}
          />
        }
      />

      <PendingDaysBar
        pendientes={pendientesOtrosDias}
        onIr={(f) => cambiarDia(f)}
      />

      {cargandoVista ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-xl" />
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-[420px] min-w-0 flex-[1_1_320px] rounded-xl" />
            <Skeleton className="h-[620px] min-w-0 flex-[2_1_560px] rounded-xl" />
          </div>
        </div>
      ) : error ? (
        <section className={cn(cardClass, "py-12 text-center text-muted-foreground")}>
          No se pudo cargar la información. Inténtalo de nuevo.
        </section>
      ) : (
        <>
          {lista.length > 0 && <DaySummary evals={lista} />}
          <div className="flex flex-wrap items-start gap-4">
            <OperatorList
              className="min-w-0 flex-[1_1_320px]"
              evals={lista}
              filtro={filtro}
              onFiltro={setFiltro}
              seleccionado={esMovil && !hojaAbierta ? null : ev?.id ?? null}
              onSelect={(id) => {
                setSeleccionado(id);
                if (esMovil) setHojaAbierta(true);
              }}
              vacio={
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Users className="size-5" />
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    Aún no hay evaluaciones para este día
                  </span>
                  <Button
                    onClick={sincronizar}
                    disabled={sincronizando}
                    className="gap-2 bg-action text-action-foreground hover:bg-action-hover"
                  >
                    <RefreshCw className={cn("size-4", sincronizando && "animate-spin")} />
                    Sincronizar operadores
                  </Button>
                </div>
              }
            />
            {!esMovil && ficha}
          </div>
        </>
      )}

      {/* Móvil: ficha en hoja a pantalla completa */}
      <Dialog open={esMovil && hojaAbierta && Boolean(ev)} onOpenChange={setHojaAbierta}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-3 overflow-y-auto rounded-none p-4 sm:max-w-full"
        >
          <DialogTitle className="sr-only">Ficha de {ev?.operador}</DialogTitle>
          <DialogDescription className="sr-only">Evaluación del operador</DialogDescription>
          <Button
            variant="ghost"
            className="-ml-2 w-fit gap-1.5 text-[13px]"
            onClick={() => setHojaAbierta(false)}
          >
            <ArrowLeft className="size-4" />
            Volver a la lista
          </Button>
          {ficha}
        </DialogContent>
      </Dialog>

      <ExportPdfDialog
        open={pdfAbierto}
        onOpenChange={setPdfAbierto}
        evals={lista}
        dia={dia}
        grupo={grupoPdf}
        usuario={usuario}
      />
    </div>
  );
}

export default function EvaluacionDiariaPage() {
  return (
    <Suspense>
      <EvaluacionContent />
    </Suspense>
  );
}
