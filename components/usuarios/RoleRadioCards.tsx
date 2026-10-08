"use client";

import { cn } from "@/lib/utils";
import { ROLES, type Rol } from "@/lib/roles";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ORDEN: Rol[] = ["agente_retiros_internacional", "agente_retiros_nacional", "admin"];

/** RadioGroup real (flechas para moverse) con una tarjeta por rol. */
export function RoleRadioCards({
  value,
  onChange,
  bloqueado,
  idBase = "rol",
}: {
  value: Rol;
  onChange: (r: Rol) => void;
  /** Deshabilita las otras opciones (propio usuario o último admin). */
  bloqueado?: boolean;
  idBase?: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as Rol)}
      className="gap-2"
      aria-label="Rol"
    >
      {ORDEN.map((r) => {
        const id = `${idBase}-${r}`;
        const deshabilitado = bloqueado && r !== value;
        return (
          <label
            key={r}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[10px] border border-border p-3 transition-colors hover:bg-muted/60",
              value === r && "border-brand bg-brand-soft/40 ring-1 ring-brand",
              deshabilitado && "cursor-not-allowed opacity-50 hover:bg-transparent",
            )}
          >
            <RadioGroupItem id={id} value={r} disabled={deshabilitado} className="mt-0.5" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-semibold">
                {ROLES[r].label}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {ROLES[r].monedas}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{ROLES[r].desc}</span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
