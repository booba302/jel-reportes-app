import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClass } from "@/components/dashboard/CardHeading";

function S({ className }: { className?: string }) {
  // Sin animación propia: la decide el contenedor (pulso solo al cargar).
  return <Skeleton className={cn("animate-none", className)} />;
}

/** 4 tarjetas, 5 monedas, mapa (5 filas) y tabla (5 filas). Con `mensaje`, queda estático. */
export function MonitorSkeleton({
  animado,
  mensaje,
  enlace,
}: {
  animado: boolean;
  mensaje?: string;
  enlace?: { href: string; label: string };
}) {
  return (
    <div className="relative">
      <div aria-hidden className={cn("flex flex-col gap-4", animado ? "animate-pulse" : "opacity-55")}>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn(cardClass, "flex flex-col gap-4")}>
              <div className="flex items-center gap-2.5">
                <S className="size-8 rounded-lg" />
                <S className="h-3.5 w-28" />
              </div>
              <S className="h-7 w-24" />
              <S className="h-3 w-3/4" />
            </div>
          ))}
        </div>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(208px,100%),1fr))]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={cn(cardClass, "flex flex-col gap-3 p-4")}>
              <S className="h-4 w-24" />
              <S className="h-6 w-20" />
              <S className="h-11 w-full" />
              <S className="h-8 w-full" />
            </div>
          ))}
        </div>
        <div className={cn(cardClass, "flex flex-col gap-1.5")}>
          <S className="mb-2 h-4 w-48" />
          {[0, 1, 2, 3, 4].map((i) => (
            <S key={i} className="h-[26px] w-full" />
          ))}
        </div>
        <div className={cn(cardClass, "flex flex-col gap-3")}>
          <S className="h-4 w-48" />
          {[0, 1, 2, 3, 4].map((i) => (
            <S key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>

      {mensaje && (
        <div className="absolute inset-x-0 top-[150px] flex justify-center px-4">
          <p
            role="status"
            className="flex items-center gap-2 rounded-full border border-input bg-card px-3.5 py-2 text-[13px] text-muted-foreground shadow-lg"
          >
            <CalendarDays className="size-4 shrink-0" /> {mensaje}
            {enlace && (
              <Link href={enlace.href} className="font-medium text-brand hover:underline">
                {enlace.label}
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
