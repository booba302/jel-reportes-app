# Dashboard Custom Date Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Rango Personalizado" option to the dashboard's period `Select` that lets the user pick an arbitrary start/end date (e.g. one specific week) via a range calendar, recomputing all dashboard metrics for that range and comparing against the equivalent immediately-preceding period.

**Architecture:** Single-file change to `app/(dashboard)/page.tsx`. Add a `customRange` state (`DateRange | undefined` from `react-day-picker`), a new `"custom"` branch in the existing date-bounds logic inside `fetchDashboardData`, and a `Popover` + range `Calendar` UI control that appears next to the existing `Select` when `"custom"` is chosen. No backend/Firestore changes — filtering stays client-side over the already-fetched `operaciones_retiros` snapshot, exactly like the other three period options.

**Tech Stack:** Next.js (App Router, client component), React `useState`/`useEffect`, `react-day-picker` (`DateRange` type, already a dependency), `date-fns` (`format`, `es` locale, already used elsewhere in the project), shadcn `Calendar`/`Popover`/`Button`/`Select` components already present in `components/ui/`.

## Global Constraints

- No new npm dependencies — `react-day-picker`, `date-fns`, and all shadcn UI components needed already exist in the project (verified: `package.json`, `components/ui/calendar.tsx`, `components/ui/popover.tsx`, `components/ui/button.tsx`).
- Follow the existing `Popover` + `Calendar` pattern already used in `app/(dashboard)/evaluacion-diaria/page.tsx` (icon button trigger, `locale={es}`, `PopoverContent className="w-auto p-0"`).
- No automated test runner exists in this project (`package.json` has no `test` script, no jest/vitest). Verification is `npm run lint`, `npx tsc --noEmit`, and manual browser testing via `npm run dev`, per [[verify]] / [[run]] conventions for this repo.
- Date-range bounds and trend comparison: `currEnd` is end-of-day (23:59:59) of the selected "to" date; `prevStart`/`prevEnd` cover the immediately preceding period of equal duration, ending 1 second before `currStart`.
- When `dateFilter === "custom"` and the range is incomplete (`from` or `to` missing), the fetch must bail out early and clear `metrics`/chart datasets so the dashboard shows its existing empty state, not stale data from a previous filter.

---

### Task 1: State, imports, and date-range computation logic

**Files:**
- Modify: `app/(dashboard)/page.tsx:1-40` (imports)
- Modify: `app/(dashboard)/page.tsx:70-78` (component state)
- Modify: `app/(dashboard)/page.tsx:86-110` (date-bounds branches in `fetchDashboardData`)
- Modify: `app/(dashboard)/page.tsx:247-248` (`useEffect` dependency array)

**Interfaces:**
- Produces: `customRange: DateRange | undefined` and `setCustomRange: React.Dispatch<React.SetStateAction<DateRange | undefined>>` (from `useState`), available to Task 2 for wiring the UI. `DateRange` has shape `{ from: Date | undefined; to: Date | undefined }` (type from `react-day-picker`).
- Consumes: nothing from other tasks (this is the foundational task).

This task has no new user-visible UI yet, so it's verified via type-checking and a temporary manual check (Task 2 adds the UI that makes it end-to-end testable in the browser). Do not skip the type-check step below — it's the only verification available until Task 2 lands.

- [ ] **Step 1: Add new imports**

In `app/(dashboard)/page.tsx`, the current import block is:

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrency } from "../context/CurrencyContext";
import {
  Activity,
  Clock,
  CheckCircle2,
  Bot,
  DollarSign,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  CalendarRange,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
```

Replace it with (adds `format`/`es` from date-fns, `Calendar as CalendarIcon` and `DateRange` type, `Button`, `Calendar`, `Popover` family):

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrency } from "../context/CurrencyContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Activity,
  Clock,
  CheckCircle2,
  Bot,
  DollarSign,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  CalendarRange,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
```

- [ ] **Step 2: Add `customRange` state**

Current code:

```tsx
export default function DashboardPage() {
  const { currency } = useCurrency();
  const [dateFilter, setDateFilter] = useState("current_month");
  const [isLoading, setIsLoading] = useState(true);
```

Replace with:

```tsx
export default function DashboardPage() {
  const { currency } = useCurrency();
  const [dateFilter, setDateFilter] = useState("current_month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(true);
```

- [ ] **Step 3: Add the `"custom"` date-bounds branch and incomplete-range guard**

Current code:

```tsx
        if (dateFilter === "current_month") {
          currStart = new Date(currentYear, currentMonth, 1);
          currEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 1, 1);
          prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        } else if (dateFilter === "last_month") {
          currStart = new Date(currentYear, currentMonth - 1, 1);
          currEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 2, 1);
          prevEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59);
        } else if (dateFilter === "last_3_months") {
          currStart = new Date(currentYear, currentMonth - 2, 1);
          currEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 5, 1);
          prevEnd = new Date(currentYear, currentMonth - 2, 0, 23, 59, 59);
        }
```

Replace with (adds the `custom` branch after `last_3_months`, before the closing brace):

```tsx
        if (dateFilter === "current_month") {
          currStart = new Date(currentYear, currentMonth, 1);
          currEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 1, 1);
          prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        } else if (dateFilter === "last_month") {
          currStart = new Date(currentYear, currentMonth - 1, 1);
          currEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 2, 1);
          prevEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59);
        } else if (dateFilter === "last_3_months") {
          currStart = new Date(currentYear, currentMonth - 2, 1);
          currEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 5, 1);
          prevEnd = new Date(currentYear, currentMonth - 2, 0, 23, 59, 59);
        } else if (dateFilter === "custom") {
          if (!customRange?.from || !customRange?.to) {
            setMetrics(null);
            setDailyData([]);
            setLevelData([]);
            setAgentData([]);
            setIsLoading(false);
            return;
          }
          currStart = customRange.from;
          currEnd = new Date(
            customRange.to.getFullYear(),
            customRange.to.getMonth(),
            customRange.to.getDate(),
            23,
            59,
            59,
          );
          const durationMs = currEnd.getTime() - currStart.getTime();
          prevEnd = new Date(currStart.getTime() - 1000);
          prevStart = new Date(prevEnd.getTime() - durationMs);
        }
```

- [ ] **Step 4: Add `customRange` to the `useEffect` dependency array**

Current code:

```tsx
    fetchDashboardData();
  }, [currency, dateFilter]); // Se recalcula si cambia la moneda o el filtro de fecha
```

Replace with:

```tsx
    fetchDashboardData();
  }, [currency, dateFilter, customRange?.from, customRange?.to]); // Se recalcula si cambia la moneda, el filtro de fecha, o el rango personalizado
```

- [ ] **Step 5: Type-check and lint**

Run: `cd "F:/Proyectos/jel-reportes-app" && npx tsc --noEmit`
Expected: No errors related to `app/(dashboard)/page.tsx`.

Run: `cd "F:/Proyectos/jel-reportes-app" && npm run lint`
Expected: No new errors/warnings for `app/(dashboard)/page.tsx`.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/page.tsx"
git commit -m "feat: add custom date range state and bounds logic to dashboard"
```

---

### Task 2: UI — range picker control next to the period Select

**Files:**
- Modify: `app/(dashboard)/page.tsx:320-333` (filter header)

**Interfaces:**
- Consumes: `customRange` / `setCustomRange` and the `"custom"` `dateFilter` branch produced in Task 1. Uses `DateRange` shape `{ from: Date | undefined; to: Date | undefined }`.
- Produces: nothing further consumed by later tasks — this is the final task.

- [ ] **Step 1: Add the "Rango Personalizado" option and the conditional range-picker button**

Current code:

```tsx
        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <CalendarRange className="w-4 h-4 text-slate-500" />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] h-9 bg-white border-slate-300 text-sm font-medium">
              <SelectValue placeholder="Rango de tiempo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mes Actual</SelectItem>
              <SelectItem value="last_month">Mes Anterior</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 Meses</SelectItem>
              <SelectItem value="all_time">Histórico Completo</SelectItem>
            </SelectContent>
          </Select>
        </div>
```

Replace with:

```tsx
        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <CalendarRange className="w-4 h-4 text-slate-500" />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] h-9 bg-white border-slate-300 text-sm font-medium">
              <SelectValue placeholder="Rango de tiempo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mes Actual</SelectItem>
              <SelectItem value="last_month">Mes Anterior</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 Meses</SelectItem>
              <SelectItem value="all_time">Histórico Completo</SelectItem>
              <SelectItem value="custom">Rango Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {dateFilter === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 justify-start text-left font-normal bg-white border-slate-300 text-sm"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange?.from && customRange?.to ? (
                    `${format(customRange.from, "dd MMM", { locale: es })} – ${format(customRange.to, "dd MMM yyyy", { locale: es })}`
                  ) : (
                    <span>Selecciona un rango</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
```

- [ ] **Step 2: Type-check and lint**

Run: `cd "F:/Proyectos/jel-reportes-app" && npx tsc --noEmit`
Expected: No errors related to `app/(dashboard)/page.tsx`.

Run: `cd "F:/Proyectos/jel-reportes-app" && npm run lint`
Expected: No new errors/warnings for `app/(dashboard)/page.tsx`.

- [ ] **Step 3: Manual verification in the browser**

Run: `cd "F:/Proyectos/jel-reportes-app" && npm run dev`

In the browser, navigate to the dashboard (`/`) and:
1. Open the period `Select` and choose "Rango Personalizado". Confirm a button reading "Selecciona un rango" appears next to the select, and the dashboard shows its empty state (no KPIs/charts) since no range is picked yet.
2. Click the button, confirm a two-month range calendar opens.
3. Pick a start date and an end date a few days apart (e.g. a Monday–Sunday week). Confirm the button now shows the formatted range (e.g. "23 jun – 29 jun 2026") and the dashboard KPIs, daily volume chart, level distribution chart, and agent table all repopulate for that range.
4. Confirm the trend pills (e.g. SLA de Cumplimiento, Tiempo Promedio) are visible and show a comparison (not hidden), since custom ranges show trends per the design.
5. Switch back to "Mes Actual" and confirm the dashboard reverts to the normal monthly view without errors.
6. Switch to "Rango Personalizado" again and confirm the previously picked range is still shown (state isn't unexpectedly cleared) and data still loads correctly.

Expected: All six checks pass with no console errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/page.tsx"
git commit -m "feat: add custom date range picker UI to dashboard period filter"
```

---

## Self-Review Notes

- **Spec coverage:** New `SelectItem` (spec §UI) → Task 2 Step 1. Popover/Calendar/Button pattern matching `evaluacion-diaria` (spec §UI) → Task 2 Step 1. `customRange` state (spec §Estado) → Task 1 Step 2. `"custom"` date-bounds branch with end-of-day `currEnd` and equal-duration previous period (spec §Lógica de fechas) → Task 1 Step 3. Incomplete-range guard / empty state (spec §Lógica de fechas) → Task 1 Step 3. `useEffect` dependency update (spec §Dependencias) → Task 1 Step 4. Trend pills unaffected for `"custom"` (spec §Tendencias) → no code change needed, confirmed by inspection of `renderTrend`'s existing `dateFilter === "all_time"` check, and verified manually in Task 2 Step 3.4. No backend/API changes (spec §Fuera de alcance) → plan touches only `app/(dashboard)/page.tsx`.
- **Placeholder scan:** No TBD/TODO markers; all steps contain full code or exact commands.
- **Type consistency:** `customRange` / `setCustomRange` names and `DateRange | undefined` type are identical between Task 1 (where declared) and Task 2 (where consumed).
