import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardHeading, cardClass } from "./CardHeading";

export function KpiCard({
  icon,
  iconClassName,
  title,
  value,
  valueTitle,
  unit,
  trend,
  footer,
  footerClassName,
  action,
  valueClassName,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  value: string;
  /** Tooltip nativo del valor (p. ej. monto completo). */
  valueTitle?: string;
  unit?: string;
  trend?: React.ReactNode;
  footer: React.ReactNode;
  footerClassName?: string;
  /** Botón chico a la derecha del título (p. ej. copiar). */
  action?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <section className={cn(cardClass, "flex min-w-0 flex-col gap-4")}>
      <div className="flex items-center justify-between gap-2">
        <CardHeading icon={icon} iconClassName={iconClassName} title={title} />
        {action}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span
          className={cn(
            "whitespace-nowrap text-[28px] font-bold leading-none tracking-tight",
            valueClassName,
          )}
          title={valueTitle}
        >
          {value}
          {unit && (
            <span className="ml-1 text-[15px] font-medium tracking-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </span>
        {trend}
      </div>
      <div className={cn("text-xs text-muted-foreground", footerClassName)}>
        {footer}
      </div>
    </section>
  );
}
