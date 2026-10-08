"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResultadoExpediente } from "@/lib/expediente";
import {
  AvisoExpediente,
  Expediente,
  nombreMesCap,
} from "@/components/expediente/Expediente";

type Respuesta =
  | ResultadoExpediente
  | { estado: "invalido" }
  | { estado: "expirado"; operador: string; mes: string }
  | { estado: "error" };

/**
 * Enlace que recibe el operador: solo su expediente, sin sidebar ni header.
 * Los datos los arma el servidor (/api/expediente-publico) tras validar el enlace,
 * así este visor no lee Firestore directamente.
 */
export default function VisorExpedienteOperador() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [res, setRes] = useState<{ id: string; r: Respuesta } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/expediente-publico/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<Respuesta>)
      .catch((): Respuesta => ({ estado: "error" }))
      .then((r) => !cancelado && setRes({ id, r }));
    return () => {
      cancelado = true;
    };
  }, [id]);

  const r = res?.id === id ? res.r : null;
  const mes = r && "mes" in r ? r.mes : null;

  let contenido: React.ReactNode;
  if (!r) {
    contenido = (
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-[72px] rounded-xl" />
        <Skeleton className="h-[118px] rounded-xl" />
        <Skeleton className="h-[330px] rounded-xl" />
      </div>
    );
  } else if (r.estado === "ok") {
    contenido = <Expediente modo="publico" data={r} />;
  } else {
    const avisos: Record<string, [string, string]> = {
      invalido: ["Enlace no válido", "Este enlace no es válido o fue eliminado."],
      expirado: ["Enlace vencido", "Este enlace expiró. Pide uno nuevo a tu supervisor."],
      revision: [
        "Expediente en revisión",
        "Este expediente se está revisando. Vuelve a abrir el enlace cuando el mes se cierre de nuevo.",
      ],
      excluido: ["Sin expediente", "Esta persona está excluida de la evaluación; su expediente no se genera."],
      "sin-datos": ["Sin evaluaciones", "No hay evaluaciones diarias para este mes."],
      error: ["No se pudo cargar", "Hubo un problema al cargar el expediente. Inténtalo de nuevo más tarde."],
    };
    const [titulo, texto] = avisos[r.estado] ?? avisos.error;
    contenido = <AvisoExpediente titulo={titulo} texto={texto} />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-sidebar">
        <div className="mx-auto flex w-full max-w-[1440px] lg:max-w-[min(1440px,calc(100vw-248px))] items-center gap-2.5 px-4 py-3 md:px-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-auto w-7" />
          <span className="font-bold tracking-tight">PayoutMetrics</span>
          <span className="text-[13px] text-muted-foreground">
            · Documento personal{mes ? ` · ${nombreMesCap(mes)}` : ""}
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1440px] lg:max-w-[min(1440px,calc(100vw-248px))] flex-col gap-4 px-4 pb-9 pt-5 md:px-7">
        {contenido}
      </main>
      <footer className="py-4 text-center text-xs text-muted-foreground">
        Desarrollado para JuegaEnLinea · v1.0 © 2026
      </footer>
    </div>
  );
}
