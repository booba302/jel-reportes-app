"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvisoExpediente } from "@/components/expediente/Expediente";
import { CalendarioMes, PieHorario, type Casilla } from "@/components/horarios/CalendarioMes";
import { nombreMesAnio } from "@/components/reportes/fechas";
import type { DiaEspecial } from "@/lib/horario";

export type RespuestaVisor =
  | {
      estado: "ok";
      meses: string[];
      mes: string;
      turnos: Casilla[];
      ausencias: { colaborador: string; tipo: string; inicio: string; retorno: string }[];
      especiales: DiaEspecial[];
    }
  | { estado: "invalido" | "no-disponible" | "error" | "sin-meses" };

const AVISOS: Record<string, [string, string]> = {
  invalido: ["Enlace no válido", "Este enlace no es válido o fue reemplazado. Pide el nuevo a tu supervisor."],
  "sin-meses": ["Aún no hay horario", "Todavía no hay un horario publicado."],
  "no-disponible": ["Mes no disponible", "Ese mes todavía no está disponible."],
  error: ["No se pudo cargar", "Hubo un problema al cargar el horario. Inténtalo de nuevo más tarde."],
};

/**
 * Horario de solo lectura con selector de mes. `cargar` trae un mes (o el último disponible
 * con null) y no lanza: los fallos vuelven como `{ estado: "error" }`.
 */
export function VisorHorario({
  cargar,
  clave = "",
}: {
  cargar: (mes: string | null) => Promise<RespuestaVisor>;
  /** Cambia cuando cambia la fuente (p. ej. el id del enlace) para volver a cargar. */
  clave?: string;
}) {
  const [mes, setMes] = useState<string | null>(null);
  const [res, setRes] = useState<{ clave: string; r: RespuestaVisor } | null>(null);
  const actual = `${clave}|${mes ?? ""}`;

  useEffect(() => {
    let cancelado = false;
    cargar(mes).then((r) => !cancelado && setRes({ clave: actual, r }));
    return () => {
      cancelado = true;
    };
  }, [cargar, mes, actual]);

  const r = res?.clave === actual ? res.r : null;

  if (!r) return <Skeleton className="h-[480px] rounded-xl" aria-hidden />;
  if (r.estado !== "ok") {
    const [titulo, texto] = AVISOS[r.estado] ?? AVISOS.error;
    return <AvisoExpediente titulo={titulo} texto={texto} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Horario · {nombreMesAnio(r.mes)}</h1>
        <Select value={r.mes} onValueChange={setMes}>
          <SelectTrigger className="w-[190px]" aria-label="Mes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {r.meses.map((m) => (
              <SelectItem key={m} value={m}>
                {nombreMesAnio(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CalendarioMes mes={r.mes} turnos={r.turnos} especiales={r.especiales} />
      <PieHorario ausencias={r.ausencias} especiales={r.especiales} />
    </div>
  );
}
