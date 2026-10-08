"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  rangoCompleto,
  textoRango,
  type DateFilter,
} from "./useDashboardData";

function ayudaRango(r: DateRange | undefined) {
  if (!r?.from) return "Elige la fecha de inicio";
  if (!rangoCompleto(r)) return "Ahora elige la fecha de fin";
  return `Rango: ${textoRango(r)}`;
}

export function PeriodFilter({
  dateFilter,
  setDateFilter,
  customRange,
  setCustomRange,
}: {
  dateFilter: DateFilter | null;
  setDateFilter: (v: DateFilter) => void;
  customRange: DateRange | undefined;
  setCustomRange: (r: DateRange | undefined) => void;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 640px)");

  const onPeriodo = (v: string) => {
    setDateFilter(v as DateFilter);
    if (v === "custom" && !rangoCompleto(customRange)) setCalOpen(true);
  };

  return (
    <>
      <Select value={dateFilter ?? undefined} onValueChange={onPeriodo}>
        <SelectTrigger
          className="h-9 min-w-[196px] gap-2 rounded-lg border-input bg-card text-[13px] font-medium shadow-xs data-[size=default]:h-9 dark:bg-card"
          aria-label="Período"
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          <SelectValue placeholder="Selecciona un período" />
        </SelectTrigger>
        <SelectContent align="end" position="popper" className="w-56">
          <SelectItem value="current_month">Mes actual</SelectItem>
          <SelectItem value="last_month">Mes anterior</SelectItem>
          <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
          <SelectItem value="all_time">Histórico completo</SelectItem>
          <SelectSeparator />
          <SelectItem value="custom">Rango personalizado…</SelectItem>
        </SelectContent>
      </Select>

      {dateFilter === "custom" && (
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-lg bg-card text-[13px] font-medium dark:bg-card"
            >
              <CalendarDays className="size-4" />
              <span className={customRange?.from ? "" : "text-muted-foreground"}>
                {textoRango(customRange)}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-3">
            <Calendar
              mode="range"
              numberOfMonths={isMobile ? 1 : 2}
              locale={es}
              showOutsideDays
              selected={customRange}
              defaultMonth={customRange?.from ?? new Date()}
              onSelect={(r) => {
                setCustomRange(r);
                if (rangoCompleto(r)) setCalOpen(false);
              }}
            />
            <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
              <span>{ayudaRango(customRange)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomRange(undefined)}
              >
                Limpiar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}

export function VipSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-[13px] font-semibold">
      Solo VIP
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-checked:bg-success"
      />
    </label>
  );
}
