"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvisoExpediente } from "@/components/expediente/Expediente";
import { CalendarioMes, PieHorario, type Casilla } from "@/components/horarios/CalendarioMes";
import { nombreMesAnio } from "@/components/reportes/fechas";
import type { DiaEspecial } from "@/lib/horario";

type Respuesta =
  | {
      estado: "ok";
      anio: number;
      meses: string[];
      mes: string;
      turnos: Casilla[];
      ausencias: { colaborador: string; tipo: string; inicio: string; retorno: string }[];
      especiales: DiaEspecial[];
    }
  | { estado: "invalido" | "no-disponible" | "error" }
  | { estado: "sin-meses"; anio: number };

/** Enlace anual que reciben los colaboradores: solo el horario, sin sidebar ni login. */
export default function VisorHorario() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [mes, setMes] = useState<string | null>(null);
  const [res, setRes] = useState<{ clave: string; r: Respuesta } | null>(null);
  const clave = `${id}|${mes ?? ""}`;

  useEffect(() => {
    let cancelado = false;
    const q = mes ? `?mes=${mes}` : "";
    fetch(`/api/horario-publico/${encodeURIComponent(id)}${q}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<Respuesta>)
      .catch((): Respuesta => ({ estado: "error" }))
      .then((r) => !cancelado && setRes({ clave, r }));
    return () => {
      cancelado = true;
    };
  }, [id, mes, clave]);

  const r = res?.clave === clave ? res.r : null;

  let contenido: React.ReactNode;
  if (!r) {
    contenido = <Skeleton className="h-[480px] rounded-xl" aria-hidden />;
  } else if (r.estado === "ok") {
    contenido = (
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
  } else {
    const avisos: Record<string, [string, string]> = {
      invalido: ["Enlace no válido", "Este enlace no es válido o fue reemplazado. Pide el nuevo a tu supervisor."],
      "sin-meses": ["Aún no hay horario", "Todavía no hay un horario publicado para este año."],
      "no-disponible": ["Mes no disponible", "Ese mes todavía no está disponible."],
      error: ["No se pudo cargar", "Hubo un problema al cargar el horario. Inténtalo de nuevo más tarde."],
    };
    const [titulo, texto] = avisos[r.estado] ?? avisos.error;
    contenido = <AvisoExpediente titulo={titulo} texto={texto} />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-sidebar">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2.5 px-4 py-3 md:px-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-auto w-7" />
          <span className="font-bold tracking-tight">PayoutMetrics</span>
          <span className="text-[13px] text-muted-foreground">· Horario de turnos</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-7">{contenido}</main>
    </div>
  );
}
