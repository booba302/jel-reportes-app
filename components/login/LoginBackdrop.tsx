import { cn } from "@/lib/utils";
import { SlaRing } from "@/components/dashboard/SlaCard";

// Serie fija (no se consultan datos: el usuario aún no está autenticado).
const VOLUMEN = [
  52, 61, 48, 70, 66, 40, 34, 58, 72, 64, 55, 47, 68, 75, 60, 38, 33, 57, 69,
  63, 50, 46, 71, 66, 59, 41, 36, 62, 74, 67, 54,
];
const SLA = [
  94, 95, 93, 96, 92, 88, 91, 95, 97, 94, 93, 96, 95, 89, 92, 94, 96, 95, 93,
  97, 94, 87, 92, 95, 96, 94, 93, 95, 97, 96, 94,
];

// Coordenadas del mini-gráfico (viewBox 800×220). SLA de 85 a 100.
const W = 800;
const H = 220;
const slaY = (v: number) => H - ((v - 85) / 15) * H;
const paso = W / VOLUMEN.length;
const linea = SLA.map(
  (v, i) => `${i === 0 ? "M" : "L"}${(i + 0.5) * paso},${slaY(v)}`,
).join(" ");

/** Bloque gris que simula texto. */
function T({ className, width }: { className?: string; width?: number }) {
  return (
    <span
      className={cn("block h-2.5 rounded bg-foreground/[0.06]", className)}
      style={width ? { width: `${width}%` } : undefined}
    />
  );
}

const card = "rounded-[14px] border border-border bg-card";

export function LoginBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 flex h-[960px] w-[1560px] select-none overflow-hidden rounded-[18px] border border-border bg-card opacity-[var(--login-backdrop-opacity)] shadow-[var(--login-backdrop-shadow)] [transform:translate(-50%,-44%)_perspective(1800px)_rotateX(30deg)_rotateZ(-9deg)] animate-login-float motion-reduce:animate-none max-sm:top-[18px] max-sm:h-[400px] max-sm:w-[620px] max-sm:animate-none max-sm:rounded-xl max-sm:[transform:translateX(-50%)_perspective(1200px)_rotateX(32deg)_rotateZ(-10deg)]"
    >
      {/* Sidebar */}
      <div className="flex w-[230px] shrink-0 flex-col gap-3.5 border-r border-border bg-sidebar p-4 max-sm:w-[92px] max-sm:gap-2 max-sm:p-2.5">
        <div className="mb-3 flex items-center gap-2.5 max-sm:mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-auto w-7 max-sm:w-5" />
          <T className="h-3 w-24 max-sm:w-10" />
        </div>
        {[70, 85, 60, 0, 75, 65, 80, 0, 70].map((w, i) =>
          w === 0 ? (
            <span key={i} className="h-2 max-sm:h-1" />
          ) : (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-2 max-sm:px-1 max-sm:py-1",
                i === 1 && "bg-sidebar-accent shadow-[0_0_0_1px_var(--border)]",
              )}
            >
              <span className="size-4 shrink-0 rounded bg-foreground/[0.08] max-sm:size-2.5" />
              <T width={w} className="max-sm:h-1.5" />
            </div>
          ),
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col gap-[18px] p-7 max-sm:gap-2.5 max-sm:p-3">
        <div className="flex flex-col gap-2 max-sm:gap-1">
          <T className="h-5 w-64 max-sm:h-3 max-sm:w-28" />
          <T className="w-80 max-sm:h-1.5 max-sm:w-36" />
        </div>

        {/* Fila 1: SLA + 3 cards + gráfico */}
        <div className="flex gap-[18px] max-sm:gap-2.5">
          <div className={cn(card, "flex w-[340px] shrink-0 flex-col gap-5 p-5 max-sm:w-[130px] max-sm:gap-2 max-sm:p-2.5")}>
            <T className="w-32 max-sm:w-14" />
            <div className="flex items-center gap-5 max-sm:gap-2">
              <div className="max-sm:hidden">
                <SlaRing value={94} />
              </div>
              <span className="hidden size-12 rounded-full border-[6px] border-success max-sm:block" />
              <div className="flex flex-col gap-2.5">
                <T className="h-7 w-24 max-sm:h-3 max-sm:w-10" />
                <T className="w-28 max-sm:w-8" />
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 max-sm:gap-1.5 max-sm:pt-2">
              <T className="w-full max-sm:h-1.5" />
              <T className="w-full max-sm:h-1.5" />
              <T className="w-full max-sm:h-1.5" />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[18px] max-sm:gap-2.5">
            <div className="grid grid-cols-3 gap-[18px] max-sm:gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className={cn(card, "flex flex-col gap-4 p-5 max-sm:gap-1.5 max-sm:p-2.5")}>
                  <T className="w-24 max-sm:w-10" />
                  <T className="h-6 w-20 max-sm:h-3 max-sm:w-8" />
                  <T className="w-3/5 max-sm:h-1.5" />
                </div>
              ))}
            </div>

            <div className={cn(card, "flex flex-1 flex-col gap-3 p-5 max-sm:gap-1.5 max-sm:p-2.5")}>
              <T className="w-40 max-sm:w-16" />
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="h-[220px] w-full max-sm:h-[90px]"
              >
                <rect x={0} y={slaY(90)} width={W} height={H - slaY(90)} fill="var(--chart-zone)" />
                {VOLUMEN.map((v, i) => (
                  <rect
                    key={i}
                    x={i * paso + paso * 0.1}
                    y={H - v * 1.6}
                    width={paso * 0.8}
                    height={v * 1.6}
                    rx={3}
                    fill="var(--chart-bar)"
                  />
                ))}
                <line
                  x1={0}
                  x2={W}
                  y1={slaY(90)}
                  y2={slaY(90)}
                  stroke="var(--danger)"
                  strokeOpacity={0.55}
                  strokeDasharray="6 6"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={linea}
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Fila 2: tabla */}
        <div className={cn(card, "flex flex-col gap-3 p-5 max-sm:gap-1.5 max-sm:p-2.5")}>
          <T className="w-48 max-sm:w-16" />
          <span className="h-8 rounded-lg bg-muted max-sm:h-3" />
          {["bg-success", "bg-success", "bg-success", "bg-warning", "bg-danger"].map(
            (color, i) => (
              <div key={i} className="flex items-center gap-4 max-sm:gap-2">
                <span className="size-7 shrink-0 rounded-full bg-foreground/[0.08] max-sm:size-3" />
                <T className="w-40 max-sm:h-1.5 max-sm:w-12" />
                <span className="ml-auto h-1.5 w-1/3 overflow-hidden rounded-full bg-track max-sm:h-1">
                  <span
                    className={cn("block h-full rounded-full", color)}
                    style={{ width: `${[96, 93, 91, 82, 68][i]}%` }}
                  />
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
