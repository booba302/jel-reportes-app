"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { parseUserRole } from "@/lib/roles";
import { useExcluidos } from "./useExcluidos";
import { usePendientesAnteriores } from "./usePendientesAnteriores";
import { chipFecha } from "./PendingDaysBar";

const CLAVE = "aviso-eval-oculto";

function leerOculto(hoy: string) {
  try {
    return typeof window !== "undefined" && sessionStorage.getItem(CLAVE) === hoy;
  } catch {
    return false;
  }
}

/** Aviso del dashboard: evaluaciones diarias pendientes de días anteriores. */
export function PendingEvalNotice() {
  const router = useRouter();
  const { userData } = useAuth();
  const rol = useMemo(() => parseUserRole(userData?.rol), [userData?.rol]);
  const excluidos = useExcluidos(userData?.nombre || "Usuario");
  const { pendientes, hoy } = usePendientesAnteriores({
    rol,
    esExcluido: excluidos.esExcluido,
    listo: Boolean(userData) && !excluidos.cargando,
  });
  const [oculto, setOculto] = useState(() => leerOculto(hoy));

  if (oculto || !pendientes || pendientes.length === 0) return null;

  const total = pendientes.reduce((s, p) => s + p.cantidad, 0);
  const masAntigua = pendientes[pendientes.length - 1].fecha;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-[inset_3px_0_0_var(--warning)]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-text">
        <ClipboardCheck className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold">
          Tienes {total} {total === 1 ? "evaluación diaria pendiente" : "evaluaciones diarias pendientes"} de
          días anteriores
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {pendientes.map((p) => `${chipFecha(p.fecha)} (${p.cantidad})`).join(" · ")}
        </span>
      </div>
      <button
        type="button"
        onClick={() => router.push(`/evaluacion-diaria?fecha=${masAntigua}`)}
        className="h-[34px] rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-background hover:opacity-90"
      >
        Ir a evaluación diaria
      </button>
      <button
        type="button"
        aria-label="Ocultar aviso"
        onClick={() => {
          try {
            sessionStorage.setItem(CLAVE, hoy);
          } catch {
            /* sin almacenamiento: se oculta solo en esta vista */
          }
          setOculto(true);
        }}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
