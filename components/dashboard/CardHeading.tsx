import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Encabezado de card: ícono en cuadrito de 32px + título. */
export function CardHeading({
  icon: Icon,
  iconClassName,
  title,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted",
          iconClassName,
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="font-medium">{title}</span>
    </div>
  );
}

export const cardClass = "rounded-xl border border-border bg-card p-[18px]";
