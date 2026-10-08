"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { esRolValido, type Rol } from "@/lib/roles";
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
import { accesoRelativo, fechaCorta, type Usuario } from "./tipos";

export function claseAvatar(rol: string) {
  return rol === "admin" ? "bg-icon-violet/15 text-icon-violet" : "bg-brand-soft text-brand";
}

/** Se monta con `key={usuario.uid}` para empezar siempre con sus valores. */
export function EditUserDialog({
  usuario,
  esYo,
  esUltimoAdmin,
  onOpenChange,
  onGuardado,
}: {
  usuario: Usuario;
  esYo: boolean;
  esUltimoAdmin: boolean;
  onOpenChange: (o: boolean) => void;
  onGuardado: () => void;
}) {
  const rolInicial: Rol = esRolValido(usuario.rol) ? usuario.rol : "agente_retiros_internacional";
  const [nombre, setNombre] = useState(usuario.nombre);
  const [rol, setRol] = useState<Rol>(rolInicial);
  const [guardando, setGuardando] = useState(false);

  const bloqueoRol = esYo
    ? "No puedes cambiar tu propio rol. Pídeselo a otro administrador."
    : esUltimoAdmin
      ? "Es el único administrador activo: asigna otro antes de cambiar su rol."
      : null;

  const nombreLimpio = nombre.trim().replace(/\s+/g, " ");
  const cambiaNombre = nombreLimpio !== usuario.nombre;
  const cambiaRol = rol !== usuario.rol && !bloqueoRol;
  const valido = nombreLimpio.length >= 2;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || (!cambiaNombre && !cambiaRol)) return;
    setGuardando(true);
    try {
      await apiFetch(`/api/usuarios/${usuario.uid}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(cambiaNombre ? { nombre: nombreLimpio } : {}),
          ...(cambiaRol ? { rol } : {}),
        }),
      });
      toast.success(
        cambiaRol ? "Cambios guardados. El nuevo rol aplica de inmediato en su sesión." : "Cambios guardados",
      );
      onGuardado();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !guardando && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-[480px]">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <DialogHeader className="flex-row items-center gap-3 text-left">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                claseAvatar(usuario.rol),
              )}
            >
              {getInitials(usuario.nombre)}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="text-base font-semibold">Editar usuario</DialogTitle>
              <DialogDescription className="text-xs">
                Creado el {fechaCorta(usuario.fechaCreacion)}
                {usuario.creadoPor ? ` por ${usuario.creadoPor}` : ""} · último acceso:{" "}
                {accesoRelativo(usuario.ultimoAcceso).toLowerCase()}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-nombre">Nombre completo</Label>
            <Input
              id="editar-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              aria-invalid={!valido}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-email">Correo</Label>
            <Input id="editar-email" value={usuario.email} readOnly className="bg-muted dark:bg-muted" />
            <p className="text-xs text-muted-foreground">
              El correo es el usuario de acceso y no se cambia. Si cambió, crea un usuario nuevo y
              desactiva este.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Rol</span>
            <RoleRadioCards
              value={rol}
              onChange={setRol}
              bloqueado={Boolean(bloqueoRol)}
              idBase={`editar-rol-${usuario.uid}`}
            />
            {bloqueoRol && <p className="text-xs text-muted-foreground">{bloqueoRol}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!valido || (!cambiaNombre && !cambiaRol) || guardando}
              className="gap-2 bg-action text-action-foreground hover:bg-action-hover"
            >
              {guardando && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
