import { cn } from "@/lib/utils";
import { formatDecimal } from "@/lib/format";

type Props = {
  value: number;
  /** "" = diferencia absoluta sin unidad (p. ej. nota). */
  unit: "pts" | "%" | "min" | "";
  decimals?: number;
  goodWhen: "up" | "down";
  hidden?: boolean;
  className?: string;
};

export function TrendPill({
  value,
  unit,
  decimals = 1,
  goodWhen,
  hidden,
  className,
}: Props) {
  if (hidden) return null;
  const neutral = Math.abs(value) < 0.1;
  const good = goodWhen === "up" ? value >= 0 : value <= 0;
  const tone = neutral
    ? "bg-muted text-muted-foreground"
    : good
      ? "bg-success-soft text-success-text"
      : "bg-danger-soft text-danger-text";
  const sign = neutral ? "" : value > 0 ? "+" : "-";

  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-2 py-[3px] text-xs font-semibold",
        tone,
        className,
      )}
    >
      {sign}
      {formatDecimal(Math.abs(value), decimals)}
      {unit === "%" ? "%" : unit ? ` ${unit}` : ""}
    </span>
  );
}

/** Variación porcentual; si el período anterior es 0 → 100 o 0. */
export function calcTrend(c: number, p: number) {
  if (p === 0) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
}
