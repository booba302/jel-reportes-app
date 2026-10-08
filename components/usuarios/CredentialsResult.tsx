"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { mensajeCredenciales } from "./tipos";

export type Credenciales = { nombre: string; email: string; password: string };

/** Resultado de crear o restablecer: la contraseña temporal se muestra una sola vez. */
export function CredentialsResult({
  cred,
  titulo,
  onListo,
}: {
  cred: Credenciales;
  titulo: string;
  onListo: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensajeCredenciales(cred));
      setCopiado(true);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciona la contraseña y cópiala a mano.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-success-soft text-success-text">
          <Check className="size-5" />
        </span>
        <DialogTitle className="text-base font-semibold">{titulo}</DialogTitle>
        <DialogDescription>Envíale estos datos por un canal privado.</DialogDescription>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[10px] bg-muted px-4 py-3 text-[13px]">
        <dt className="text-muted-foreground">Usuario</dt>
        <dd className="min-w-0 break-all font-mono">{cred.email}</dd>
        <dt className="self-center text-muted-foreground">Contraseña temporal</dt>
        <dd className="select-all font-mono text-[15px] font-bold tracking-wide">{cred.password}</dd>
      </dl>

      <p className="flex items-start gap-2.5 rounded-[10px] border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-text">
        <TriangleAlert className="mt-px size-4 shrink-0" />
        Esta contraseña no se vuelve a mostrar. Si se pierde, restablécela de nuevo. Vence en 72
        horas si no se usa.
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={onListo}>
          Listo
        </Button>
        <Button
          onClick={copiar}
          className="gap-2 bg-action text-action-foreground hover:bg-action-hover"
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiado ? "Copiado" : "Copiar mensaje"}
        </Button>
      </DialogFooter>
    </div>
  );
}
