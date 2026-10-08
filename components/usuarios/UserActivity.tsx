"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { etiquetaRol } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClass } from "@/components/dashboard/CardHeading";
import { fechaActividad } from "./tipos";
import { useActividad, type Actividad } from "./useUsuarios";

const PUNTO: Record<Actividad["accion"], string> = {
  crear: "bg-success",
  reactivar: "bg-success",
  restablecer: "bg-warning",
  desactivar: "bg-danger",
  rol: "bg-brand",
  editar: "bg-brand",
  cambio_password: "bg-brand",
};

export function textoActividad(a: Actividad) {
  const d = a.detalle ?? {};
  switch (a.accion) {
    case "crear":
      return `${a.porNombre} creó a ${a.objetivoNombre}${d.rolNuevo ? ` como ${etiquetaRol(d.rolNuevo)}` : ""}`;
    case "rol":
      return `${a.porNombre} cambió el rol de ${a.objetivoNombre}: ${etiquetaRol(d.rolAnterior ?? "")} → ${etiquetaRol(d.rolNuevo ?? "")}`;
    case "editar":
      return d.nombreAnterior
        ? `${a.porNombre} cambió el nombre de ${d.nombreAnterior} a ${a.objetivoNombre}`
        : `${a.porNombre} editó a ${a.objetivoNombre}`;
    case "restablecer":
      return `${a.porNombre} restableció la contraseña de ${a.objetivoNombre}`;
    case "desactivar":
      return `${a.porNombre} desactivó a ${a.objetivoNombre}`;
    case "reactivar":
      return `${a.porNombre} reactivó a ${a.objetivoNombre}`;
    case "cambio_password":
      return `${a.objetivoNombre} cambió su contraseña temporal`;
  }
}

function Lista({ items }: { items: Actividad[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 border-b border-border py-2.5 last:border-0">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", PUNTO[a.accion])} aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px]">{textoActividad(a)}</span>
            <span className="text-xs text-muted-foreground">{fechaActividad(a.el)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TodoSheet({ open, onOpenChange, version }: { open: boolean; onOpenChange: (o: boolean) => void; version: number }) {
  const items = useActividad(open, 200, version);
  const [usuario, setUsuario] = useState("todos");
  const personas = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of items ?? []) m.set(a.objetivoUid, a.objetivoNombre);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);
  const visibles = (items ?? []).filter((a) => usuario === "todos" || a.objetivoUid === usuario);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="pb-3">
          <SheetTitle>Actividad de usuarios</SheetTitle>
          <SheetDescription>Últimos 30 días</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-3">
          <Select value={usuario} onValueChange={setUsuario}>
            <SelectTrigger className="h-9 w-full" aria-label="Filtrar por usuario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los usuarios</SelectItem>
              {personas.map(([uid, nombre]) => (
                <SelectItem key={uid} value={uid}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {items == null ? (
            <Skeleton className="h-40 w-full" />
          ) : visibles.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">Sin actividad.</p>
          ) : (
            <Lista items={visibles} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UserActivity({ version, className }: { version: number; className?: string }) {
  const items = useActividad(true, 8, version);
  const [todo, setTodo] = useState(false);

  return (
    <section className={cn(cardClass, "flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Actividad reciente</h2>
        <span className="text-xs text-muted-foreground">30 días</span>
      </div>
      {items == null ? (
        <div className="flex flex-col gap-3 py-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Sin cambios en los últimos 30 días.</p>
      ) : (
        <Lista items={items} />
      )}
      <Button variant="ghost" className="mt-auto h-8 self-start px-2 text-[13px] text-brand" onClick={() => setTodo(true)}>
        Ver todo
      </Button>
      <TodoSheet open={todo} onOpenChange={setTodo} version={version} />
    </section>
  );
}
