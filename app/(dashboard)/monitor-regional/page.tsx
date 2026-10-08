"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCw } from "lucide-react";
import { addMonths, format, getDaysInMonth } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";
import { armarModelo, peorMoneda, type Moneda } from "@/lib/monitor";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/dashboard/CardHeading";
import { nombreMesAnio, parseMesStr, toMesStr } from "@/components/reportes/fechas";
import { ExportPdfDialog } from "@/components/pdf/ExportPdfDialog";
import { MonitorHeader } from "@/components/monitor/MonitorHeader";
import { MonitorKpis } from "@/components/monitor/MonitorKpis";
import { CurrencyCards } from "@/components/monitor/CurrencyCards";
import { SlaHeatmap } from "@/components/monitor/SlaHeatmap";
import { HourlyGaps } from "@/components/monitor/HourlyGaps";
import { WorstDays } from "@/components/monitor/WorstDays";
import { ComparisonTable } from "@/components/monitor/ComparisonTable";
import { MonitorSkeleton } from "@/components/monitor/MonitorSkeleton";
import { documentoMonitor } from "@/components/monitor/exportar";
import { useMonitor } from "@/components/monitor/useMonitor";

function MonitorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { userData } = useAuth();
  const usuario = userData?.nombre || "Usuario";

  const [hoy] = useState(() => new Date());
  const mesActual = toMesStr(hoy);
  const [mes, setMes] = useState(() => {
    const m = searchParams.get("mes");
    return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m <= mesActual ? m : mesActual;
  });
  useEffect(() => {
    router.replace(`${pathname}?mes=${mes}`, { scroll: false });
  }, [mes, pathname, router]);

  const [soloVip, setSoloVip] = useState(false);
  const [elegida, setElegida] = useState<Moneda | null>(null);
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const [intento, setIntento] = useState(0);

  // Al cambiar de mes o filtro vuelve a mostrarse la moneda con peor estado.
  const vistaKey = `${mes}|${soloVip}`;
  const [vistaPrevia, setVistaPrevia] = useState(vistaKey);
  if (vistaPrevia !== vistaKey) {
    setVistaPrevia(vistaKey);
    setElegida(null);
  }

  const fechaMes = parseMesStr(mes);
  const fechaPrev = addMonths(fechaMes, -1);
  const mesAnterior = toMesStr(fechaPrev);
  const mesPrevio = format(fechaPrev, "MMM", { locale: es }).replace(".", ""); // "ago"
  const mesPrevioLargo = format(fechaPrev, "LLLL", { locale: es }); // "agosto"
  const enCurso = mes === mesActual;

  const { cargando, error, actual, anterior } = useMonitor(mes, mesAnterior, mesActual, intento);

  const avisado = useRef<string | null>(null);
  useEffect(() => {
    if (error && avisado.current !== `${mes}|${intento}`) {
      avisado.current = `${mes}|${intento}`;
      toast.error("No se pudo cargar el monitor regional");
    }
  }, [error, mes, intento]);

  const modelo = useMemo(
    () =>
      actual && anterior
        ? armarModelo({
            actual,
            anterior,
            soloVip,
            diasDelMes: getDaysInMonth(fechaMes),
            diasMesAnterior: getDaysInMonth(fechaPrev),
            enCurso,
          })
        : null,
    // fechaMes y fechaPrev derivan de `mes`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actual, anterior, soloVip, mes, enCurso],
  );

  const conDatos = modelo && modelo.filas.length > 0;
  const seleccionada = conDatos
    ? modelo.filas.some((f) => f.moneda === elegida)
      ? elegida
      : peorMoneda(modelo.filas)
    : null;
  const filaSel = modelo?.filas.find((f) => f.moneda === seleccionada) ?? null;
  const textoComparacion = enCurso
    ? `variación contra los mismos ${modelo?.diasConDatos ?? 0} días de ${mesPrevioLargo}`
    : `variación contra ${mesPrevioLargo}`;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      <MonitorHeader
        mes={mes}
        mesActual={mesActual}
        onMes={setMes}
        diasConDatos={modelo?.diasConDatos ?? null}
        soloVip={soloVip}
        onSoloVip={setSoloVip}
        onPdf={() => setPdfAbierto(true)}
        pdfDisabled={!conDatos}
      />

      {soloVip && (
        <p className="rounded-[10px] bg-brand-soft px-3.5 py-2.5 text-[13px] text-brand">
          Mostrando solo retiros VIP (Nivel 2, 3 y 4). Todas las tarjetas, el mapa y la tabla usan
          este filtro.
        </p>
      )}

      {error ? (
        <section className={cn(cardClass, "flex flex-col items-center gap-3 py-12 text-center")}>
          <p className="text-muted-foreground">No se pudo cargar el monitor regional.</p>
          <Button variant="outline" className="gap-2" onClick={() => setIntento((n) => n + 1)}>
            <RotateCw className="size-4" />
            Reintentar
          </Button>
        </section>
      ) : cargando || !modelo ? (
        <MonitorSkeleton animado />
      ) : !conDatos ? (
        <MonitorSkeleton
          animado={false}
          mensaje={
            soloVip && actual && actual.length > 0
              ? `No hay retiros VIP en ${nombreMesAnio(mes)}.`
              : `No hay retiros cargados en ${nombreMesAnio(mes)}.`
          }
          enlace={
            soloVip && actual && actual.length > 0
              ? undefined
              : { href: `/reportes?mes=${mes}`, label: "Cárgalos desde Reportes." }
          }
        />
      ) : (
        <>
          <MonitorKpis m={modelo} mesPrevio={mesPrevio} />
          <CurrencyCards filas={modelo.filas} seleccionada={seleccionada} onSeleccionar={setElegida} />
          <SlaHeatmap mes={mes} filas={modelo.filas} seleccionada={seleccionada} />
          <div className="flex flex-wrap items-stretch gap-3.5">
            {filaSel && <HourlyGaps className="min-w-0 flex-[1.6_1_520px]" fila={filaSel} />}
            <WorstDays className="min-w-0 flex-[1_1_340px]" mes={mes} dias={modelo.criticos} />
          </div>
          <ComparisonTable m={modelo} seleccionada={seleccionada} textoComparacion={textoComparacion} />
        </>
      )}

      <ExportPdfDialog
        open={pdfAbierto}
        onOpenChange={setPdfAbierto}
        titulo="Exportar monitor regional"
        doc={
          pdfAbierto && conDatos
            ? documentoMonitor({ m: modelo, mes, soloVip, mesPrevio, mesPrevioLargo, usuario })
            : null
        }
        aviso={
          enCurso &&
          `El mes está en curso: el PDF muestra ${modelo?.diasConDatos ?? 0} días y los compara contra los mismos días de ${mesPrevioLargo}.`
        }
      />
    </div>
  );
}

export default function MonitorRegionalPage() {
  return (
    <Suspense>
      <MonitorContent />
    </Suspense>
  );
}
