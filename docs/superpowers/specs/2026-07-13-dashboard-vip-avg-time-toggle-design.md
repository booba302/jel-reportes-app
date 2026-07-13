# Dashboard: VIP-only toggle for "Tiempo Promedio" card

## Problem

The main dashboard's "Tiempo Promedio" card shows the average resolution time
across all evaluable withdrawals (i.e. excluding retiros exonerados from
audit), mixing all `Nivel` values (1, 2, 3, 4, or no level / "Estándar").
There's no way to see the average time for VIP users (Nivel 2, 3, or 4) in
isolation.

## Solution

Add a switch next to the existing date-range selector in the dashboard
header. When on, the "Tiempo Promedio" card shows the average time computed
only from VIP (Nivel 2/3/4) evaluable withdrawals for the current filtered
period, plus a trend pill comparing VIP-only current vs. VIP-only previous
period. When off, the card behaves exactly as it does today (all levels).

The switch only affects the "Tiempo Promedio" card. No other card or chart on
the page changes.

## Data layer (`app/(dashboard)/page.tsx`)

- Extend `Metrics` with `vipAvgTime: number` and extend the trend object with
  `vipAvgTime: number`.
- In `calcMetrics(dataset)`, alongside the existing evaluable/time
  accumulation, add a second accumulator scoped to VIP records: a record is
  VIP if `!isExonerated(d.comentarioBrecha)` (same exoneration rule as today)
  AND `["2", "3", "4"].includes(String(d.Nivel).trim())`.
- `vipAvgTime = vipEvaluableTx > 0 ? vipTime / vipEvaluableTx : 0` — same
  fallback pattern already used for `avgTime`/`slaPct`.
- Compute `vipAvgTime` for both `curr` and `prev` via the same `calcMetrics`
  call (no separate query), and derive its trend with the existing
  `calcTrend` helper, exactly like `avgTime`'s trend today.

## UI layer

- New local state `showVipOnly` (boolean, default `false`) in
  `DashboardPage`.
- New `components/ui/switch.tsx` — a shadcn-style wrapper around the `Switch`
  primitive from the already-installed `radix-ui` package (no new
  dependency). Styled consistently with the existing `button.tsx`/`select.tsx`
  components in this project (slate/primary color scheme, rounded-full track).
- Place the switch in the header bar (`app/(dashboard)/page.tsx`, the
  `flex items-center gap-3 bg-slate-50 ...` container that currently holds the
  `CalendarRange` icon and date-range `Select`), as a small labeled control
  (e.g. "Solo VIP") next to the date selector — not inside the card itself.
- In the "Tiempo Promedio" `CardContent`:
  - When `showVipOnly` is `false` (default): unchanged — shows
    `metrics.current.avgTime`, its trend, and the subtitle
    "Tiempo general de resolución".
  - When `showVipOnly` is `true`: shows `metrics.current.vipAvgTime`, its
    trend (`renderTrend(metrics.trend.vipAvgTime, true)`, same reversed
    color logic since higher time is still worse), and subtitle
    "Niveles VIP (2, 3, 4)".

## Edge cases

- Zero VIP-evaluable transactions in a period → `vipAvgTime` is `0` (same as
  existing zero-transaction fallback elsewhere on this page).
- `dateFilter === "all_time"` → `renderTrend` already returns `null` in this
  case regardless of VIP toggle state; unchanged.
- Switch state is not reset when currency/date filter changes — it's a pure
  display toggle over already-fetched `metrics`, so it persists across filter
  changes within the session (component state resets naturally on page
  navigation/unmount).

## Out of scope

- No changes to the "Distribución por Nivel VIP" pie chart, the daily volume
  chart, or the agent ranking table.
- No changes to any other dashboard page (auditoria-diaria, monitor-regional,
  expediente, evaluacion-diaria).
