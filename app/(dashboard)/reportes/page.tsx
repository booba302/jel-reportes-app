"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrency } from "@/app/context/CurrencyContext";
import { useAuth } from "@/app/context/AuthContext";
import { MonthPicker } from "@/components/reportes/MonthPicker";
import { MonthCalendar } from "@/components/reportes/MonthCalendar";
import { DayPanel } from "@/components/reportes/DayPanel";
import { PendingList } from "@/components/reportes/PendingList";
import { CargaReporteDialog } from "@/components/reportes/CargaReporteDialog";
import { useReportesMes } from "@/components/reportes/useReportesMes";
import { useDiaDetalle } from "@/components/reportes/useDiaDetalle";
import { useCargaReporte } from "@/components/reportes/useCargaReporte";
import { toDiaStr } from "@/components/reportes/fechas";

/** Lee ?mes=2026-08&dia=24; ignora meses futuros y días no seleccionables. */
function leerParams(params: URLSearchParams, hoy: string) {
  const mesActual = hoy.slice(0, 7);
  const mesParam = params.get("mes");
  const mes =
    mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) && mesParam <= mesActual
      ? mesParam
      : mesActual;

  const diaNum = Number(params.get("dia"));
  let dia: string | null = null;
  if (Number.isInteger(diaNum) && diaNum >= 1 && diaNum <= 31) {
    const candidato = `${mes}-${String(diaNum).padStart(2, "0")}`;
    // Fecha real (descarta 31 de febrero, etc.) y anterior a hoy.
    const valido = toDiaStr(new Date(`${candidato}T12:00:00`)) === candidato;
    if (valido && candidato < hoy) dia = candidato;
  }
  return { mes, dia };
}

function ReportesContent() {
  const searchParams = useSearchParams();
  const { currency } = useCurrency();
  const { userData } = useAuth();

  const [hoy] = useState(() => toDiaStr(new Date()));
  const mesActual = hoy.slice(0, 7);
  const [inicial] = useState(() => leerParams(searchParams, hoy));
  const [mes, setMes] = useState(inicial.mes);
  const [seleccionado, setSeleccionado] = useState<string | null>(inicial.dia);

  // Al cambiar de moneda se limpia la selección (el mes se recarga solo).
  const [monedaPrevia, setMonedaPrevia] = useState(currency);
  if (monedaPrevia !== currency) {
    setMonedaPrevia(currency);
    setSeleccionado(null);
  }

  const { dias, cargandoMes, recargar } = useReportesMes(currency, mes, hoy);
  const diaSel = dias?.find((d) => d.dia === seleccionado) ?? null;
  const {
    detalle,
    cargando: cargandoDetalle,
    error: errorDetalle,
    invalidar,
  } = useDiaDetalle(diaSel?.estado === "cargado" ? diaSel.historial : null);

  const trasCambio = useCallback(
    (dia: string) => {
      invalidar(`${currency}_${dia}`);
      recargar();
      setSeleccionado(dia);
    },
    [currency, invalidar, recargar],
  );

  const carga = useCargaReporte({
    currency,
    subidoPor: userData?.nombre || "Usuario Desconocido",
    rol: userData?.rol || "",
    hoy,
    onCargado: trasCambio,
  });

  const cambiarMes = (m: string) => {
    setMes(m);
    setSeleccionado(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">
            Reportes
          </h1>
          <p className="text-muted-foreground">
            Carga y gestión de los reportes diarios · moneda {currency}
          </p>
        </div>
        <MonthPicker mes={mes} mesActual={mesActual} onChange={cambiarMes} />
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <MonthCalendar
          className="min-w-0 flex-[3_1_600px]"
          mes={mes}
          dias={dias}
          seleccionado={seleccionado}
          onSelect={setSeleccionado}
        />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <DayPanel
            dia={diaSel}
            hoy={hoy}
            currency={currency}
            detalle={detalle}
            cargandoDetalle={cargandoDetalle}
            errorDetalle={errorDetalle}
            onCargar={carga.abrir}
            onBorrado={trasCambio}
            cargando={cargandoMes}
          />
          <PendingList
            className="flex-1"
            mes={mes}
            dias={dias}
            hoy={hoy}
            currency={currency}
            seleccionado={seleccionado}
            onSelect={setSeleccionado}
            onCargar={(dia) => {
              setSeleccionado(dia);
              carga.abrir(dia);
            }}
          />
        </div>
      </div>

      <CargaReporteDialog
        fase={carga.fase}
        dia={carga.dia}
        falla={carga.falla}
        archivo={carga.archivo}
        setArchivo={carga.setArchivo}
        reintentar={carga.reintentar}
        cancelar={carga.cancelar}
        procesarArchivo={carga.procesarArchivo}
      />
    </div>
  );
}

export default function ReportesPage() {
  return (
    <Suspense>
      <ReportesContent />
    </Suspense>
  );
}
