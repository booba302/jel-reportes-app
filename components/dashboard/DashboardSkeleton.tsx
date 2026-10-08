import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClass } from "./CardHeading";

// Alturas fijas (en %) para las 31 barras del gráfico.
const BARRAS = [
  42, 55, 48, 62, 38, 30, 51, 58, 66, 44, 35, 49, 61, 53, 40, 28, 47, 57, 64,
  50, 37, 45, 60, 54, 41, 33, 52, 63, 56, 46, 39,
];

function S({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  // Sin animación propia: la decide el contenedor (pulso solo al cargar).
  return <Skeleton className={cn("animate-none", className)} style={style} />;
}

export function DashboardSkeleton({
  animado,
  mensaje,
}: {
  animado: boolean;
  mensaje?: string;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className={cn(
          "flex flex-col gap-4",
          animado ? "animate-pulse" : "opacity-55",
        )}
      >
        {/* Fila 1 */}
        <div className="flex flex-wrap items-stretch gap-3.5">
          <div className={cn(cardClass, "flex flex-[1_1_300px] flex-col gap-5")}>
            <div className="flex items-center gap-2.5">
              <S className="size-8 rounded-lg" />
              <S className="h-3.5 w-[150px]" />
            </div>
            <div className="flex items-center gap-5">
              <S className="size-32 rounded-full" />
              <div className="flex flex-col gap-2.5">
                <S className="h-9 w-28" />
                <S className="h-[18px] w-36 rounded-full" />
                <S className="h-3 w-40" />
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
              <S className="h-3.5 w-full" />
              <S className="h-3.5 w-full" />
              <S className="h-3.5 w-full" />
            </div>
          </div>

          <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-3.5">
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
              {[0, 1, 2].map((i) => (
                <div key={i} className={cn(cardClass, "flex flex-col gap-4")}>
                  <div className="flex items-center gap-2.5">
                    <S className="size-8 rounded-lg" />
                    <S className="h-3.5 w-24" />
                  </div>
                  <div className="flex items-end justify-between">
                    <S className="h-[26px] w-[90px]" />
                    <S className="h-[18px] w-[52px] rounded-full" />
                  </div>
                  <S className="h-3 w-3/5" />
                </div>
              ))}
            </div>
            <div className={cn(cardClass, "flex flex-1 flex-col gap-4")}>
              <div className="flex items-center justify-between">
                <S className="h-4 w-40" />
                <S className="h-3 w-56" />
              </div>
              <div className="flex h-[220px] items-end gap-1.5">
                {BARRAS.map((h, i) => (
                  <S
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fila 2 */}
        <div className="flex flex-wrap items-stretch gap-3.5">
          <div className={cn(cardClass, "flex min-w-0 flex-[2_1_560px] flex-col gap-4")}>
            <S className="h-4 w-48" />
            <S className="h-[34px] w-full rounded-lg" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <S className="size-7 rounded-full" />
                <S className="h-3.5 w-32" />
                <S className="ml-auto h-1.5 w-1/3 rounded-full" />
              </div>
            ))}
          </div>
          <div className={cn(cardClass, "flex min-w-0 flex-[1_1_300px] flex-col gap-4")}>
            <S className="h-4 w-48" />
            <S className="h-[26px] w-24" />
            {[0, 1, 2, 3].map((i) => (
              <S key={i} className="h-3.5 w-full" />
            ))}
          </div>
        </div>
      </div>

      {mensaje && (
        <div className="pointer-events-none absolute inset-x-0 top-[150px] flex justify-center px-4">
          <p
            role="status"
            className="flex items-center gap-2 rounded-full border border-input bg-card px-3.5 py-2 text-[13px] text-muted-foreground shadow-lg"
          >
            <CalendarDays className="size-4 shrink-0" /> {mensaje}
          </p>
        </div>
      )}
    </div>
  );
}
