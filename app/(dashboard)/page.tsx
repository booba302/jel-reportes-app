"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Banknote, Bot, Clock } from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";
import { TIEMPO_META_MIN } from "@/lib/constants";
import {
  formatDecimal,
  formatEntero,
  formatMontoCompacto,
  formatMontoCompleto,
  formatMontoExacto,
  formatPct,
} from "@/lib/format";
import {
  useDashboardData,
  type DateFilter,
  type EstadoDashboard,
} from "@/components/dashboard/useDashboardData";
import { PeriodFilter, VipSwitch } from "@/components/dashboard/PeriodFilter";
import { SlaCard } from "@/components/dashboard/SlaCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TrendPill, calcTrend } from "@/components/dashboard/TrendPill";
import { DailySlaVolumeChart } from "@/components/dashboard/DailySlaVolumeChart";
import { TeamPerformanceTable } from "@/components/dashboard/TeamPerformanceTable";
import { VipDistributionCard } from "@/components/dashboard/VipDistributionCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { PendingEvalNotice } from "@/components/evaluacion/PendingEvalNotice";

const MENSAJES: Partial<Record<EstadoDashboard, string>> = {
  "sin-periodo": "Selecciona un rango de fechas para cargar los datos",
  "rango-incompleto": "Selecciona la fecha de inicio y fin para cargar los datos",
  "sin-datos": "No hay datos procesados para el rango seleccionado",
  error: "No se pudieron cargar los datos. Intenta de nuevo.",
};

export default function DashboardPage() {
  const { currency } = useCurrency();
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [showVipOnly, setShowVipOnly] = useState(false);

  const { estado, periodo, data } = useDashboardData(
    currency,
    dateFilter,
    customRange,
  );

  const esGlobal = currency === "GLOBAL";
  const titulo = esGlobal ? "Visión global" : "Visión de rendimiento";
  const subtitulo = [
    periodo?.etiqueta ?? "Sin período seleccionado",
    esGlobal ? "todas las monedas" : `moneda ${currency}`,
    showVipOnly ? "solo VIP" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const vista = data ? data[showVipOnly ? "vip" : "todos"] : null;
  const sinTendencia = !periodo?.etiquetaAnterior;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      <PendingEvalNotice />

      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">
            {titulo}
          </h1>
          <p className="text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <PeriodFilter
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            customRange={customRange}
            setCustomRange={setCustomRange}
          />
          <VipSwitch checked={showVipOnly} onCheckedChange={setShowVipOnly} />
        </div>
      </div>

      {vista && periodo ? (
        <>
          {/* Fila 1 */}
          <div className="flex flex-wrap items-stretch gap-3.5">
            <SlaCard
              className="flex-[1_1_300px]"
              actual={vista.actual}
              anterior={vista.anterior}
              etiquetaAnterior={periodo.etiquetaAnterior}
            />
            <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-3.5">
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                <KpiCard
                  icon={Clock}
                  iconClassName="text-icon-amber"
                  title="Tiempo promedio"
                  value={formatDecimal(vista.actual.tiempo)}
                  unit="min"
                  trend={
                    <TrendPill
                      hidden={sinTendencia}
                      value={calcTrend(vista.actual.tiempo, vista.anterior.tiempo)}
                      unit="%"
                      goodWhen="down"
                    />
                  }
                  footer={`Meta ${TIEMPO_META_MIN} min · solo gestión manual`}
                  footerClassName={
                    vista.actual.tiempo > TIEMPO_META_MIN
                      ? "text-danger-text"
                      : undefined
                  }
                />
                <KpiCard
                  icon={Banknote}
                  iconClassName="text-icon-blue"
                  title="Monto procesado"
                  action={
                    esGlobal ? undefined : (
                      <CopyButton
                        text={formatMontoExacto(vista.actual.monto)}
                        label="Copiar monto exacto"
                      />
                    )
                  }
                  value={formatMontoCompacto(vista.actual.monto, currency)}
                  valueTitle={
                    esGlobal
                      ? undefined
                      : formatMontoCompleto(vista.actual.monto, currency)
                  }
                  trend={
                    <TrendPill
                      hidden={sinTendencia || esGlobal}
                      value={calcTrend(vista.actual.monto, vista.anterior.monto)}
                      unit="%"
                      goodWhen="up"
                    />
                  }
                  footer={`${formatEntero(vista.actual.total)} ${showVipOnly ? "retiros VIP" : "retiros"}`}
                />
                <KpiCard
                  icon={Bot}
                  iconClassName="text-icon-violet"
                  title="Automatización"
                  value={formatPct(vista.actual.automatizacion)}
                  trend={
                    <TrendPill
                      hidden={sinTendencia}
                      value={
                        vista.actual.automatizacion -
                        vista.anterior.automatizacion
                      }
                      unit="pts"
                      goodWhen="up"
                    />
                  }
                  footer={`${formatEntero(vista.actual.autopago)} por Autopago`}
                />
              </div>
              <DailySlaVolumeChart className="flex-1" data={vista.diaria} />
            </div>
          </div>

          {/* Fila 2 */}
          <div className="flex flex-wrap items-stretch gap-3.5">
            <TeamPerformanceTable
              className="min-w-0 flex-[2_1_560px]"
              operadores={vista.operadores}
            />
            <VipDistributionCard
              className="min-w-0 flex-[1_1_300px]"
              niveles={vista.niveles}
              soloVip={showVipOnly}
            />
          </div>
        </>
      ) : (
        <DashboardSkeleton
          animado={estado === "cargando"}
          mensaje={MENSAJES[estado]}
        />
      )}
    </div>
  );
}
