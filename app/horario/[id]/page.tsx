"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { VisorHorario, type RespuestaVisor } from "@/components/horarios/VisorHorario";

/** Enlace anual que reciben los colaboradores: solo el horario, sin sidebar ni login. */
export default function VisorHorarioPublico() {
  const params = useParams();
  const id = String(params.id ?? "");
  const cargar = useCallback(
    (mes: string | null) =>
      fetch(`/api/horario-publico/${encodeURIComponent(id)}${mes ? `?mes=${mes}` : ""}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<RespuestaVisor>)
        .catch((): RespuestaVisor => ({ estado: "error" })),
    [id],
  );

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
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-7">
        <VisorHorario cargar={cargar} clave={id} />
      </main>
    </div>
  );
}
