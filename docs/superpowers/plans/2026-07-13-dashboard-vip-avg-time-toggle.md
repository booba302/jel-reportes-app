# Dashboard VIP Avg-Time Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a switch next to the dashboard's date-range selector that, when on, makes the "Tiempo Promedio" card show the average resolution time for VIP-level withdrawals only (Nivel 2, 3, or 4), instead of all levels.

**Architecture:** Single-file change to `app/(dashboard)/page.tsx`. The existing `calcMetrics` function already loops over evaluable (non-exonerated) records to compute `avgTime`; it gains a second accumulator scoped to VIP records (same exoneration rule, plus `Nivel` in `["2","3","4"]`), exposed as `vipAvgTime` on `Metrics` and its trend on `PeriodComparison.trend`. A new `showVipOnly` boolean state drives a checkbox-based switch (reusing the exact `sr-only peer` toggle visual pattern already used in this codebase's audit-exoneration switches, rather than adding a new `components/ui/switch.tsx` — this project has no test framework and prefers inlining this pattern over introducing a UI-library wrapper, per `docs/superpowers/plans/2026-07-01-auditoria-exoneracion-switches.md`) placed next to the date-range `Select`. The "Tiempo Promedio" card reads `vipAvgTime`/`avgTime` conditionally on `showVipOnly`.

**Tech Stack:** Next.js (App Router), React (client component, `useState`), Firestore read-only query (`getDocs`), Tailwind CSS. No test framework is configured in this repo (`package.json` has no jest/vitest/playwright) — verification is manual via the dev server, matching how prior dashboard features in this codebase were verified.

## Global Constraints

- VIP levels are exactly `Nivel` values `"2"`, `"3"`, or `"4"` (string-compared via `String(d.Nivel).trim()`) — matches the user's stated levels 1/2/3/4/none, where 2-4 are VIP and 1/none are not.
- The switch only affects the "Tiempo Promedio" card. No other card, chart, or table on this page changes.
- Reuse the existing `sr-only peer` checkbox-toggle visual pattern (`w-8 h-4 bg-slate-200 ... peer-checked:bg-emerald-500`) already used elsewhere in this codebase — do not add a new Radix-based switch component.
- Do not change `isExonerated` in `lib/utils.ts` or the exoneration rule itself — VIP filtering is an additional, independent condition on top of the existing evaluable/non-exonerated check.
- The trend pill for VIP mode compares VIP-only current-period avg time vs. VIP-only previous-period avg time (via the existing `calcTrend` helper), not vs. the all-levels average.
- Switch state (`showVipOnly`) is local component state, not reset when `currency`/`dateFilter`/`customRange` change.

---

### Task 1: Add VIP-only average time computation and header switch

**Files:**
- Modify: `app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: existing `isExonerated` from `@/lib/utils`, existing `calcMetrics`, `calcTrend`, `renderTrend`, `Metrics`/`PeriodComparison` interfaces, existing `currency`/`dateFilter` state.
- Produces: nothing consumed by other tasks — this is the only task in the plan.

- [ ] **Step 1: Add the `VIP_LEVELS` constant**

  Find (currently lines 73-80):

  ```tsx
  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ef4444",
    "#06b6d4",
  ];
  ```

  Replace with:

  ```tsx
  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ef4444",
    "#06b6d4",
  ];

  const VIP_LEVELS = ["2", "3", "4"];
  ```

- [ ] **Step 2: Extend `Metrics` and `PeriodComparison` with `vipAvgTime`**

  Find (currently lines 55-71):

  ```tsx
  interface Metrics {
    totalTx: number;
    totalAmount: number;
    slaPct: number;
    avgTime: number;
    autoPct: number;
  }
  interface PeriodComparison {
    current: Metrics;
    trend: {
      totalTx: number;
      totalAmount: number;
      slaPct: number;
      avgTime: number;
      autoPct: number;
    };
  }
  ```

  Replace with:

  ```tsx
  interface Metrics {
    totalTx: number;
    totalAmount: number;
    slaPct: number;
    avgTime: number;
    vipAvgTime: number;
    autoPct: number;
  }
  interface PeriodComparison {
    current: Metrics;
    trend: {
      totalTx: number;
      totalAmount: number;
      slaPct: number;
      avgTime: number;
      vipAvgTime: number;
      autoPct: number;
    };
  }
  ```

- [ ] **Step 3: Add the `showVipOnly` state**

  Find (currently lines 88-93):

  ```tsx
    const [isLoading, setIsLoading] = useState(true);

    const [metrics, setMetrics] = useState<PeriodComparison | null>(null);
    const [dailyData, setDailyData] = useState<any[]>([]);
    const [levelData, setLevelData] = useState<any[]>([]);
    const [agentData, setAgentData] = useState<any[]>([]);
  ```

  Replace with:

  ```tsx
    const [isLoading, setIsLoading] = useState(true);
    const [showVipOnly, setShowVipOnly] = useState(false);

    const [metrics, setMetrics] = useState<PeriodComparison | null>(null);
    const [dailyData, setDailyData] = useState<any[]>([]);
    const [levelData, setLevelData] = useState<any[]>([]);
    const [agentData, setAgentData] = useState<any[]>([]);
  ```

- [ ] **Step 4: Accumulate VIP time/count inside `calcMetrics`**

  Find (currently lines 225-249):

  ```tsx
        const calcMetrics = (dataset: any[]): Metrics => {
          let tx = 0,
            amount = 0,
            slaCount = 0,
            time = 0,
            autoCount = 0,
            evaluableTx = 0;
          dataset.forEach((d) => {
            tx++;
            amount += (Number(d.Cantidad) || 0) / 100;
            if (d.Operador === "Autopago") autoCount++;
            if (!isExonerated(d.comentarioBrecha)) {
              evaluableTx++;
              time += Number(d.Tiempo) || 0;
              if (d.Cumple) slaCount++;
            }
          });
          return {
            totalTx: tx,
            totalAmount: amount,
            slaPct: evaluableTx > 0 ? (slaCount / evaluableTx) * 100 : 0,
            avgTime: evaluableTx > 0 ? time / evaluableTx : 0,
            autoPct: tx > 0 ? (autoCount / tx) * 100 : 0,
          };
        };
  ```

  Replace with:

  ```tsx
        const calcMetrics = (dataset: any[]): Metrics => {
          let tx = 0,
            amount = 0,
            slaCount = 0,
            time = 0,
            autoCount = 0,
            evaluableTx = 0,
            vipTime = 0,
            vipEvaluableTx = 0;
          dataset.forEach((d) => {
            tx++;
            amount += (Number(d.Cantidad) || 0) / 100;
            if (d.Operador === "Autopago") autoCount++;
            if (!isExonerated(d.comentarioBrecha)) {
              evaluableTx++;
              time += Number(d.Tiempo) || 0;
              if (d.Cumple) slaCount++;
              if (VIP_LEVELS.includes(String(d.Nivel).trim())) {
                vipEvaluableTx++;
                vipTime += Number(d.Tiempo) || 0;
              }
            }
          });
          return {
            totalTx: tx,
            totalAmount: amount,
            slaPct: evaluableTx > 0 ? (slaCount / evaluableTx) * 100 : 0,
            avgTime: evaluableTx > 0 ? time / evaluableTx : 0,
            vipAvgTime: vipEvaluableTx > 0 ? vipTime / vipEvaluableTx : 0,
            autoPct: tx > 0 ? (autoCount / tx) * 100 : 0,
          };
        };
  ```

- [ ] **Step 5: Add the `vipAvgTime` trend to `setMetrics`**

  Find (currently lines 260-269):

  ```tsx
        setMetrics({
          current: curr,
          trend: {
            totalTx: calcTrend(curr.totalTx, prev.totalTx),
            totalAmount: calcTrend(curr.totalAmount, prev.totalAmount),
            slaPct: curr.slaPct - prev.slaPct, // Puntos porcentuales directos
            avgTime: calcTrend(curr.avgTime, prev.avgTime),
            autoPct: curr.autoPct - prev.autoPct,
          },
        });
  ```

  Replace with:

  ```tsx
        setMetrics({
          current: curr,
          trend: {
            totalTx: calcTrend(curr.totalTx, prev.totalTx),
            totalAmount: calcTrend(curr.totalAmount, prev.totalAmount),
            slaPct: curr.slaPct - prev.slaPct, // Puntos porcentuales directos
            avgTime: calcTrend(curr.avgTime, prev.avgTime),
            vipAvgTime: calcTrend(curr.vipAvgTime, prev.vipAvgTime),
            autoPct: curr.autoPct - prev.autoPct,
          },
        });
  ```

- [ ] **Step 6: Add the VIP switch next to the date-range selector**

  Find (currently lines 368-424):

  ```tsx
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />{" "}
            {(currency as string) === "GLOBAL"
              ? "Visión Global (Todas las Monedas)"
              : "Visión de Rendimiento"}
          </h1>
          <p className="text-slate-500 mt-1">
            Análisis operativo para{" "}
            <strong className="text-primary">{currency}</strong>.
          </p>
        </div>

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
      </div>
  ```

  Replace with:

  ```tsx
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />{" "}
            {(currency as string) === "GLOBAL"
              ? "Visión Global (Todas las Monedas)"
              : "Visión de Rendimiento"}
          </h1>
          <p className="text-slate-500 mt-1">
            Análisis operativo para{" "}
            <strong className="text-primary">{currency}</strong>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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

          <label className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer select-none">
            <span className="text-sm font-medium text-slate-600">
              Solo VIP
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showVipOnly}
                onChange={(e) => setShowVipOnly(e.target.checked)}
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500" />
            </div>
          </label>
        </div>
      </div>
  ```

- [ ] **Step 7: Make the "Tiempo Promedio" card read VIP-only values when the switch is on**

  Find (currently lines 466-490):

  ```tsx
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Tiempo Promedio
                </CardTitle>
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-slate-800">
                    {metrics.current.avgTime.toFixed(1)}{" "}
                    <span className="text-lg font-medium text-slate-500">
                      min
                    </span>
                  </div>
                  {/* reverseColors = true porque un aumento en tiempo es malo (Rojo) */}
                  {renderTrend(metrics.trend.avgTime, true)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Tiempo general de resolución
                </p>
              </CardContent>
            </Card>
  ```

  Replace with:

  ```tsx
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Tiempo Promedio
                </CardTitle>
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-slate-800">
                    {(showVipOnly
                      ? metrics.current.vipAvgTime
                      : metrics.current.avgTime
                    ).toFixed(1)}{" "}
                    <span className="text-lg font-medium text-slate-500">
                      min
                    </span>
                  </div>
                  {/* reverseColors = true porque un aumento en tiempo es malo (Rojo) */}
                  {renderTrend(
                    showVipOnly
                      ? metrics.trend.vipAvgTime
                      : metrics.trend.avgTime,
                    true,
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {showVipOnly
                    ? "Niveles VIP (2, 3, 4)"
                    : "Tiempo general de resolución"}
                </p>
              </CardContent>
            </Card>
  ```

- [ ] **Step 8: Type-check and lint**

  Run:
  ```bash
  npx tsc --noEmit
  npm run lint
  ```
  Expected: no new errors introduced in `app/(dashboard)/page.tsx`.

- [ ] **Step 9: Manual verification via dev server**

  Run:
  ```bash
  npm run dev
  ```
  Open the dashboard (`/`) for a currency with existing data. Verify:
  1. The "Solo VIP" switch renders next to the date-range selector, off by default.
  2. With the switch off, "Tiempo Promedio" shows the same value and subtitle ("Tiempo general de resolución") as before this change.
  3. Turn the switch on → the number changes (unless the currently-filtered period happens to have identical VIP vs. all-levels average), the subtitle changes to "Niveles VIP (2, 3, 4)", and the trend pill updates.
  4. With the switch on, change the date-range filter (e.g. Mes Actual → Mes Anterior) → the VIP figure recomputes for the new period without needing to re-toggle the switch.
  5. Switch to "Histórico Completo" (`all_time`) with the switch on → no trend pill is shown (same as the existing all-time behavior for other cards).
  6. Turn the switch back off → the card returns to the all-levels value.
  7. No other card (SLA, Volumen Procesado, Automatización) or chart changes when toggling the switch.

  Report each of the 7 checks as pass/fail. Do not report the task complete unless all 7 pass.

- [ ] **Step 10: Commit**

  ```bash
  git add "app/(dashboard)/page.tsx"
  git commit -m "$(cat <<'EOF'
feat: add VIP-only toggle for dashboard average time card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
  ```

---

## Self-Review Notes

- **Spec coverage:** `vipAvgTime` data computation with same exoneration rule + Nivel 2/3/4 filter ✓ (Step 4), VIP-to-VIP trend comparison ✓ (Step 5), switch placed next to date selector ✓ (Step 6), card conditionally shows VIP vs. general values/subtitle/trend ✓ (Step 7), no other card/chart affected ✓ (Step 9 check 7), zero-VIP-transaction fallback ✓ (Step 4's `vipEvaluableTx > 0 ? ... : 0`), all_time trend suppression unchanged ✓ (Step 9 check 5, no code change needed since `renderTrend` already gates on `dateFilter === "all_time"`). All spec sections have a corresponding step.
- **Placeholder scan:** no TBD/TODO; all code blocks are complete and copy-pasteable.
- **Type consistency:** `vipAvgTime` added identically to `Metrics` and `PeriodComparison.trend` (Step 2), populated in both `calcMetrics` (Step 4) and `setMetrics` (Step 5), consumed only in Step 7; `showVipOnly` typed as `boolean` via `useState(false)` (Step 3) and used consistently in Steps 6-7; `VIP_LEVELS` defined once (Step 1) and referenced once (Step 4).
