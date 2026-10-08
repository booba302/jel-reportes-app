"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, CalendarX, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { subDays } from "date-fns";
import { useCurrency, type Currency } from "@/app/context/CurrencyContext";
import { useAuth } from "@/app/context/AuthContext";
import { monedasPermitidas } from "@/lib/monedas";
import { SLA_META_PCT, TIEMPO_META_MIN, SLA_UMBRAL_MIN } from "@/lib/constants";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { cardClass } from "@/components/dashboard/CardHeading";
import { toDiaStr } from "@/components/reportes/fechas";
import { AuditHeader } from "@/components/auditoria/AuditHeader";
import { HourlyChart } from "@/components/auditoria/HourlyChart";
import { OperatorPerformance } from "@/components/auditoria/OperatorPerformance";
import { FiltersPanel } from "@/components/auditoria/FiltersPanel";
import { AuditTable } from "@/components/auditoria/AuditTable";
import { ExoneracionDialog } from "@/components/auditoria/ExoneracionDialog";
import { useAuditoria } from "@/components/auditoria/useAuditoria";
import { documentoAuditoria } from "@/components/auditoria/exportar";
import { ExportPdfDialog } from "@/components/pdf/ExportPdfDialog";
import {
  PESTANAS,
  contadoresOperador,
  desempeno,
  filasDePestana,
  kpis,
  nivelDe,
  porHora,
  type NivelFiltro,
  type Pestana,
} from "@/components/auditoria/calculos";

/** `fecha` válida y anterior a hoy; si no, ayer. */
function leerFecha(param: string | null, hoy: string, ayer: string) {
  const f = param?.split("T")[0] ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return ayer;
  const real = toDiaStr(new Date(`${f}T12:00:00`)) === f;
  return real && f < hoy ? f : ayer;
}

function AuditoriaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();
  const { userData } = useAuth();

  const [{ hoy, ayer }] = useState(() => {
    const now = new Date();
    return { hoy: toDiaStr(now), ayer: toDiaStr(subDays(now, 1)) };
  });
  const [fecha, setFecha] = useState(() =>
    leerFecha(searchParams.get("fecha"), hoy, ayer),
  );

  // ?moneda=PEN: se aplica una sola vez, cuando ya se conoce el rol del usuario.
  const [monedaParam] = useState(() => searchParams.get("moneda"));
  const monedaAplicada = useRef(false);
  useEffect(() => {
    if (monedaAplicada.current || !userData) return;
    monedaAplicada.current = true;
    const permitidas = monedasPermitidas(userData.rol || "");
    if (monedaParam && permitidas.includes(monedaParam as Currency))
      setCurrency(monedaParam as Currency);
  }, [userData, monedaParam, setCurrency]);

  // La URL refleja el día y la moneda (enlace compartible, botón Atrás).
  // Con ?moneda= se espera al usuario, para no pisar el parámetro antes de aplicarlo.
  const esperandoUsuario = Boolean(monedaParam) && !userData;
  useEffect(() => {
    if (esperandoUsuario) return;
    const params = new URLSearchParams({ fecha, moneda: currency });
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [fecha, currency, pathname, router, esperandoUsuario]);

  // Filtros
  const [nivel, setNivel] = useState<NivelFiltro>("Todos");
  // ?operador=Juan: preselecciona ese operador (desde la Evaluación diaria).
  const [operador, setOperador] = useState(() => searchParams.get("operador") || "Todos");
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<Pestana>("todos");
  const [pagina, setPagina] = useState(1);
  const [opModalId, setOpModalId] = useState<string | null>(null);
  const [pdfAbierto, setPdfAbierto] = useState(false);

  // Al cambiar de día o moneda: página 1. El operador se mantiene si existe ese día.
  const diaKey = `${currency}|${fecha}`;
  const [diaKeyPrevio, setDiaKeyPrevio] = useState(diaKey);
  if (diaKeyPrevio !== diaKey) {
    setDiaKeyPrevio(diaKey);
    setPagina(1);
  }

  const { cargando, error, ops, nota, guardarComentario, guardarNota } =
    useAuditoria(currency, fecha);

  const d = useMemo(() => {
    const todos = ops ?? [];
    const nivelScope =
      nivel === "Todos" ? todos : todos.filter((op) => nivelDe(op) === nivel);
    // Si el operador elegido no tiene retiros en este día/nivel, se muestra "Todos".
    const operadorEf = nivelScope.some((op) => op.operador === operador)
      ? operador
      : "Todos";
    const scope =
      operadorEf === "Todos"
        ? nivelScope
        : nivelScope.filter((op) => op.operador === operadorEf);
    const q = busqueda.trim().toLowerCase();
    const buscados = q
      ? scope.filter(
          (op) => op.alias.toLowerCase().includes(q) || op.id.toLowerCase().includes(q),
        )
      : scope;
    const contadores = Object.fromEntries(
      PESTANAS.map((p) => [p.id, filasDePestana(buscados, p.id).length]),
    ) as Record<Pestana, number>;
    return {
      operadorEf,
      scope,
      buscados,
      k: kpis(scope, nivelScope),
      horas: porHora(scope),
      desempeno: desempeno(nivelScope),
      operadores: contadoresOperador(nivelScope),
      contadores,
      filas: filasDePestana(buscados, pestana),
    };
  }, [ops, nivel, operador, busqueda, pestana]);

  const opModal = ops?.find((op) => op.id === opModalId) ?? null;

  const conPagina1 =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPagina(1);
    };

  const sinDatos = !cargando && (error || (ops?.length ?? 0) === 0);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-5 md:px-7">
      <div className="flex flex-col gap-4">
        <AuditHeader
          fecha={fecha}
          ayer={ayer}
          currency={currency}
          onFecha={setFecha}
          onPdf={() => setPdfAbierto(true)}
          exportDisabled={cargando || sinDatos}
        />

        {cargando ? (
          <AuditSkeleton />
        ) : sinDatos ? (
          <section
            className={cn(cardClass, "flex flex-col items-center gap-2 py-14 text-center")}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarX className="size-5" />
            </span>
            <span className="text-lg font-semibold">
              {error ? "No se pudo cargar el día" : "Sin datos"}
            </span>
            <span className="max-w-sm text-[13px] text-muted-foreground">
              {error
                ? "Hubo un problema al consultar los retiros. Inténtalo de nuevo."
                : `No hay retiros de ${currency} cargados para este día.`}
            </span>
            {!error && (
              <Link
                href={`/reportes?mes=${fecha.slice(0, 7)}&dia=${fecha.slice(8, 10)}`}
                className="mt-2 rounded-lg bg-action px-4 py-2 text-[13px] font-medium text-action-foreground hover:bg-action-hover"
              >
                Ir a Reportes para cargarlo
              </Link>
            )}
          </section>
        ) : (
          <>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
              <KpiCard
                icon={CircleCheck}
                iconClassName="text-icon-green"
                title="SLA del día"
                value={formatPct(d.k.sla)}
                valueClassName={d.k.sla < SLA_META_PCT ? "text-danger-text" : undefined}
                footer={`${formatEntero(d.k.cumplidos)} de ${formatEntero(d.k.evaluables)} bajo ${SLA_UMBRAL_MIN} min · sin Autopago ni exonerados`}
              />
              <KpiCard
                icon={Clock}
                iconClassName="text-icon-amber"
                title="Tiempo promedio"
                value={formatDecimal(d.k.tiempo)}
                unit="min"
                footer={`Solo gestión manual · meta ${TIEMPO_META_MIN} min`}
                footerClassName={
                  d.k.tiempo > TIEMPO_META_MIN ? "text-danger-text" : undefined
                }
              />
              <KpiCard
                icon={TriangleAlert}
                iconClassName="text-danger-text"
                title="Brechas"
                value={formatEntero(d.k.brechas)}
                unit="retiros"
                valueClassName="text-danger-text"
                footer={
                  d.k.exoneradas
                    ? `${formatEntero(d.k.exoneradas)} ya ${d.k.exoneradas === 1 ? "exonerada" : "exoneradas"}`
                    : "Ninguna exonerada"
                }
              />
              <KpiCard
                icon={Bot}
                iconClassName="text-icon-violet"
                title="Autopago"
                value={formatPct(d.k.autopagoPct)}
                footer={`${formatEntero(d.k.autopago)} retiros automáticos de ${formatEntero(d.k.totalNivel)}`}
              />
            </div>

            <div className="flex flex-wrap items-stretch gap-3.5">
              <HourlyChart className="min-w-0 flex-[3_1_560px]" datos={d.horas} />
              <OperatorPerformance
                className="min-w-0 flex-[2_1_340px]"
                filas={d.desempeno}
              />
            </div>
          </>
        )}
      </div>

      {!cargando && !sinDatos && (
        <div className="flex flex-wrap items-stretch gap-3.5">
          <FiltersPanel
            className="flex-[1_1_230px]"
            busqueda={busqueda}
            onBusqueda={conPagina1(setBusqueda)}
            operadores={d.operadores}
            operador={d.operadorEf}
            onOperador={conPagina1(setOperador)}
            nivel={nivel}
            onNivel={(n) => {
              setNivel(n);
              setOperador("Todos"); // cambiar el nivel reinicia el operador
              setPagina(1);
            }}
            nota={nota}
            notaKey={diaKey}
            onGuardarNota={guardarNota}
          />
          <AuditTable
            className="min-w-0 flex-[4_1_640px]"
            pestana={pestana}
            onPestana={conPagina1(setPestana)}
            contadores={d.contadores}
            filas={d.filas}
            pagina={pagina}
            onPagina={setPagina}
            onExonerar={(op) => setOpModalId(op.id)}
          />
        </div>
      )}

      <ExoneracionDialog
        op={opModal}
        onGuardar={guardarComentario}
        onCerrar={() => setOpModalId(null)}
      />

      <ExportPdfDialog
        open={pdfAbierto}
        onOpenChange={setPdfAbierto}
        titulo="Exportar auditoría del día"
        doc={
          pdfAbierto && !sinDatos
            ? documentoAuditoria({
                fecha,
                currency,
                nivel,
                operador: d.operadorEf,
                scope: d.scope,
                k: d.k,
                horas: d.horas,
                desempeno: d.desempeno,
                nota,
                usuario: userData?.nombre || "Usuario",
              })
            : null
        }
      />
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(cardClass, "flex flex-col gap-4")}>
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3.5">
        <Skeleton className="h-[300px] min-w-0 flex-[3_1_560px] rounded-xl" />
        <Skeleton className="h-[300px] min-w-0 flex-[2_1_340px] rounded-xl" />
      </div>
      <div className="flex flex-wrap gap-3.5">
        <Skeleton className="h-[420px] flex-[1_1_230px] rounded-xl" />
        <Skeleton className="h-[420px] min-w-0 flex-[4_1_640px] rounded-xl" />
      </div>
    </div>
  );
}

export default function ReporteDiarioPage() {
  return (
    <Suspense>
      <AuditoriaContent />
    </Suspense>
  );
}
