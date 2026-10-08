"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import type { Rol } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleRadioCards } from "./RoleRadioCards";
import { CredentialsResult, type Credenciales } from "./CredentialsResult";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const YA_EXISTE = "Ya existe un usuario con este correo.";

export function CreateUserDialog({
  open,
  onOpenChange,
  correosExistentes,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  correosExistentes: Set<string>;
  onCreado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("agente_retiros_internacional");
  const [tocadoEmail, setTocadoEmail] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cred, setCred] = useState<Credenciales | null>(null);

  const emailNorm = email.trim().toLowerCase();
  const errorEmail =
    errorServidor ??
    (!emailNorm
      ? null
      : !EMAIL_RE.test(emailNorm)
        ? "Escribe un correo válido."
        : correosExistentes.has(emailNorm)
          ? YA_EXISTE
          : null);
  const valido = nombre.trim().length >= 2 && EMAIL_RE.test(emailNorm) && !errorEmail;

  const reiniciar = () => {
    setNombre("");
    setEmail("");
    setRol("agente_retiros_internacional");
    setTocadoEmail(false);
    setErrorServidor(null);
    setCred(null);
  };

  const cerrar = () => {
    onOpenChange(false);
    // Se limpia al terminar la animación de cierre.
    setTimeout(reiniciar, 200);
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      const r = await apiFetch<Credenciales>("/api/usuarios", {
        method: "POST",
        body: JSON.stringify({ nombre: nombre.trim(), email: emailNorm, rol }),
      });
      setCred({ nombre: r.nombre, email: r.email, password: r.password });
      onCreado();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear el usuario.";
      if (msg === YA_EXISTE) setErrorServidor(msg);
      else toast.error(msg);
    } finally {
      setEnviando(false);
    }
  };

  const mostrarErrorEmail = tocadoEmail && errorEmail;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : !cred && !enviando && cerrar())}>
      <DialogContent
        showCloseButton={!cred}
        // Con la contraseña en pantalla no se cierra por accidente.
        onEscapeKeyDown={(e) => cred && e.preventDefault()}
        onInteractOutside={(e) => cred && e.preventDefault()}
        className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-[480px]"
      >
        {cred ? (
          <CredentialsResult cred={cred} titulo={`${cred.nombre} fue creado`} onListo={cerrar} />
        ) : (
          <form onSubmit={crear} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Nuevo usuario</DialogTitle>
              <DialogDescription>
                Se genera una contraseña temporal. La persona la cambia en su primer ingreso.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-nombre">Nombre completo</Label>
              <Input
                id="nuevo-nombre"
                autoComplete="off"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-email">Correo</Label>
              <Input
                id="nuevo-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorServidor(null);
                }}
                onBlur={() => setTocadoEmail(true)}
                aria-invalid={Boolean(mostrarErrorEmail)}
                aria-describedby="nuevo-email-ayuda"
                placeholder="usuario@empresa.com"
                className={cn(mostrarErrorEmail && "border-danger focus-visible:border-danger")}
              />
              <p
                id="nuevo-email-ayuda"
                className={cn("text-xs", mostrarErrorEmail ? "text-danger-text" : "text-muted-foreground")}
              >
                {mostrarErrorEmail || "Será su usuario para iniciar sesión."}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Rol</span>
              <RoleRadioCards value={rol} onChange={setRol} idBase="nuevo-rol" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={cerrar} disabled={enviando}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!valido || enviando}
                className="gap-2 bg-action text-action-foreground hover:bg-action-hover"
              >
                {enviando && <Loader2 className="size-4 animate-spin" />}
                Crear y generar contraseña
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
