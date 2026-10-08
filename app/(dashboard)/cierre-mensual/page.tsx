"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { arrayUnion, doc, setDoc, updateDoc } from "firebase/firestore";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { parseUserRole } from "@/lib/roles";
import { normalizarNombre } from "@/lib/evaluacion";
import { capitalizar } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClass } from "@/components/dashboard/CardHeading";
import { MonthPicker } from "@/components/reportes/MonthPicker";
import { parseMesStr, toMesStr } from "@/components/reportes/fechas";
import { useExcluidos } from "@/components/evaluacion/useExcluidos";
import { useCierreMes, useEstadoMeses, idCierre } from "@/components/cierre/useCierreMes";
import { ClosingSteps } from "@/components/cierre/ClosingSteps";
import { MonthKpis } from "@/components/cierre/MonthKpis";
import { TopOperatorCard } from "@/components/cierre/TopOperatorCard";
import { TeamTrend } from "@/components/cierre/TeamTrend";
import { RankingTable } from "@/components/cierre/RankingTable";
import { copiarEnlaceExpediente } from "@/components/cierre/enlaces";
import { documentoCierre } from "@/components/cierre/exportar";
import { PdfButton } from "@/components/pdf/PdfButton";
import { ExportPdfDialog } from "@/components/pdf/ExportPdfDialog";

type Chip = { label: string; className: string };

function CierreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, userData } = useAuth();
  const rol = useMemo(() => parseUserRole(userData?.rol), [userData?.rol]);
  const usuario = userData?.nombre || "Usuario";
  const panel = rol.isAdmin ? "Administrador" : rol.isInter ? "Internacional" : "Nacional";
  const grupoCierre = rol.isAdmin ? "Global" : rol.grupoUsuario;

  const [hoy] = useState(() => new Date());
  const mesActual = toMesStr(hoy);
  const [mes, setMes] = useState(() => {
    const m = searchParams.get("mes");
    return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m <= mesActual ? m : mesActual;
  });
  useEffect(() => {
    router.replace(`${pathname}?mes=${mes}`, { scroll: false });
  }, [mes, pathname, router]);

  const excluidosHook = useExcluidos(usuario);
  const excluidosSet = useMemo(
    () => new Set((excluidosHook.lista ?? []).map(normalizarNombre)),
    [excluidosHook.lista],
  );
  const listo = Boolean(userData) && !excluidosHook.cargando;

  const [version, setVersion] = useState(0);
  const { cargando, error, actual, previo, tendencia } = useCierreMes({
    mes,
    rol,
    excluidos: excluidosSet,
    listo,
    version,
  });

  const [anioVisible, setAnioVisible] = useState(() => Number(mes.slice(0, 4)));
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const estados = useEstadoMeses(anioVisible, rol, listo, version);

  const nombreMes = capitalizar(format(parseMesStr(mes), "LLLL yyyy", { locale: es }));
  const nombreAnterior = format(addMonths(parseMesStr(mes), -1), "LLLL", { locale: es });

  // Estado del mes
  let chip: Chip | null = null;
  if (actual) {
    const terminado = mes < mesActual;
    const listoParaCerrar =
      terminado && actual.vivo.diasTotales > 0 && actual.vivo.diasPendientes.length === 0;
    chip = actual.cerrado
      ? { label: "Cerrado", className: "bg-success-soft text-success-text" }
      : mes === mesActual
        ? { label: "En curso", className: "bg-brand-soft text-brand" }
        : listoParaCerrar
          ? { label: "Listo para cerrar", className: "bg-warning-soft text-warning-text" }
          : { label: "Pendiente", className: "bg-warning-soft text-warning-text" };
  }

  // Permiso para reabrir: admin o quien cerró.
  const doc_ = actual?.documento ?? null;
  const permisoReabrir = !doc_
    ? null
    : rol.isAdmin
      ? "Puedes reabrirlo como administrador."
      : (doc_.cerradoPorUid && doc_.cerradoPorUid === user?.uid) ||
          (!doc_.cerradoPorUid && doc_.cerradoPor === userData?.nombre)
        ? "Puedes reabrirlo porque tú lo cerraste."
        : null;

  const refCierre = () => doc(db, "evaluaciones_mensuales", idCierre(mes, rol));

  const cerrar = async () => {
    if (!actual || !user) return;
    const ahora = new Date().toISOString();
    try {
      await setDoc(
        refCierre(),
        {
          mes,
          grupo: grupoCierre,
          estado: "cerrado",
          cerradoEl: ahora,
          cerradoPor: usuario,
          cerradoPorUid: user.uid,
          metrics: actual.vivo.metrics,
          ranking: actual.vivo.ranking,
          excluidos: excluidosHook.lista ?? [],
          historial: arrayUnion({ accion: "cierre", por: usuario, porUid: user.uid, el: ahora }),
        },
        { merge: true },
      );
      toast.success(`${nombreMes} cerrado · ranking guardado`);
      setVersion((v) => v + 1);
    } catch (err) {
      console.error("Error al cerrar el mes:", err);
      toast.error("Error al cerrar el mes en Firebase.");
    }
  };

  const reabrir = async (motivo: string) => {
    if (!doc_ || !user) return;
    const ahora = new Date().toISOString();
    try {
      await updateDoc(refCierre(), {
        estado: "reabierto",
        historial: arrayUnion({
          accion: "reapertura",
          por: usuario,
          porUid: user.uid,
          el: ahora,
          motivo,
          snapshotAnterior: {
            metrics: doc_.metrics,
            ranking: doc_.ranking,
            cerradoEl: doc_.cerradoEl,
            cerradoPor: doc_.cerradoPor,
          },
        }),
        cerradoEl: null,
        cerradoPor: null,
        cerradoPorUid: null,
      });
      toast.success(
        `Cierre de ${format(parseMesStr(mes), "LLLL", { locale: es })} reabierto por ${usuario}`,
      );
      setVersion((v) => v + 1);
    } catch (err) {
      console.error("Error al reabrir el cierre:", err);
      toast.error("No se pudo reabrir el cierre. Revisa tus permisos.");
    }
  };

  const datosExport = actual && {
    mes,
    nombreMes,
    grupo: panel,
    cerrado: actual.cerrado,
    cerradoEl: doc_?.cerradoEl ?? null,
    cerradoPor: doc_?.cerradoPor ?? null,
    ranking: actual.ranking,
    metrics: actual.metrics,
    previo: previo?.metrics ?? null,
    excluidos: actual.cerrado && doc_?.excluidos.length ? doc_.excluidos : excluidosHook.lista ?? [],
    usuario,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">
              Cierre mensual
            </h1>
            {chip && (
              <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-semibold", chip.className)}>
                {chip.label}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            Panel {panel} · {nombreMes}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthPicker
            mes={mes}
            mesActual={mesActual}
            onChange={(m) => {
              setMes(m);
              setAnioVisible(Number(m.slice(0, 4)));
            }}
            estados={estados}
            onAnioVisible={setAnioVisible}
          />
          <span aria-hidden className="h-6 w-px bg-border" />
          <PdfButton disabled={!datosExport} onClick={() => setPdfAbierto(true)} />
        </div>
      </div>

      {cargando || !listo ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <Skeleton className="h-[110px] rounded-xl" />
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-xl" />
            ))}
          </div>
          <div className="flex flex-wrap gap-3.5">
            <Skeleton className="h-[320px] min-w-0 flex-[1_1_380px] rounded-xl" />
            <Skeleton className="h-[320px] min-w-0 flex-[1.4_1_460px] rounded-xl" />
          </div>
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : error || !actual ? (
        <section className={cn(cardClass, "py-12 text-center text-muted-foreground")}>
          No se pudo cargar la información del mes. Inténtalo de nuevo.
        </section>
      ) : (
        <>
          <ClosingSteps
            mes={mes}
            mesActual={mesActual}
            hoy={hoy}
            vivo={actual.vivo}
            cerrado={actual.cerrado}
            documento={actual.documento}
            permisoReabrir={permisoReabrir}
            resumen={{ ranking: actual.vivo.ranking, metrics: actual.vivo.metrics }}
            onCerrar={cerrar}
            onReabrir={reabrir}
          />
          <MonthKpis m={actual.metrics} previo={previo?.metrics ?? null} nombreAnterior={nombreAnterior} />
          <div className="flex flex-wrap items-stretch gap-3.5">
            <TopOperatorCard
              className="min-w-0 flex-[1_1_380px]"
              ranking={actual.ranking}
              cerrado={actual.cerrado}
              enCurso={mes === mesActual}
            />
            <TeamTrend
              className="min-w-0 flex-[1.4_1_460px]"
              meses={tendencia}
              mesActual={mesActual}
            />
          </div>
          <RankingTable
            ranking={actual.ranking}
            mes={mes}
            cerrado={actual.cerrado}
            cantidadExcluidos={
              actual.cerrado && doc_?.excluidos.length
                ? doc_.excluidos.length
                : (excluidosHook.lista ?? []).length
            }
            onCopiarEnlace={(op) => copiarEnlaceExpediente(op, mes, usuario)}
          />
        </>
      )}

      <ExportPdfDialog
        open={pdfAbierto}
        onOpenChange={setPdfAbierto}
        titulo="Exportar cierre del mes"
        doc={pdfAbierto && datosExport ? documentoCierre(datosExport) : null}
        aviso={
          datosExport &&
          !datosExport.cerrado &&
          "El mes aún no está cerrado. El PDF sale marcado como PRELIMINAR."
        }
      />
    </div>
  );
}

export default function CierreMensualPage() {
  return (
    <Suspense>
      <CierreContent />
    </Suspense>
  );
}
