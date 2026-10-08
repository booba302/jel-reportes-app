"use client";

import { useMemo, useState } from "react";
import { Ban, KeyRound, Pencil, Search, UserCheck } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { ROLES, esRolValido, etiquetaRol } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cardClass } from "@/components/dashboard/CardHeading";
import { claseAvatar } from "./EditUserDialog";
import {
  accesoRelativo,
  estadoDe,
  fechaCorta,
  sinTildes,
  type Estado,
  type Usuario,
} from "./tipos";

type FiltroRol = "todos" | "admin" | "inter" | "nacional";
type FiltroEstado = "todos" | "activos" | "pendientes" | "inactivos";

const grupoDe = (rol: string): Exclude<FiltroRol, "todos"> =>
  rol === "admin" ? "admin" : rol === "agente_retiros_nacional" ? "nacional" : "inter";

const CHIP: Record<Estado, { clase: string; punto: string }> = {
  Activo: { clase: "bg-success-soft text-success-text", punto: "bg-success" },
  Pendiente: { clase: "bg-warning-soft text-warning-text", punto: "bg-warning" },
  "Temporal vencida": { clase: "bg-danger-soft text-danger-text", punto: "bg-danger" },
  Inactivo: { clase: "bg-muted text-muted-foreground", punto: "bg-muted-foreground" },
};

// Mismo segmentado que la lista de la Evaluación diaria.
const segmento =
  "h-8 gap-1.5 rounded-[7px] px-2.5 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-segment-active data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,.18),0_0_0_1px_var(--input)]";
const grupoSegmentado = "rounded-[9px] border border-border bg-muted p-[3px]";

function Accion({
  label,
  tooltip,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* El span deja ver el tooltip aunque el botón esté deshabilitado. */}
        <span tabIndex={disabled ? 0 : -1} className="inline-flex rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8 rounded-md", className)}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function UsersTable({
  usuarios,
  yoUid,
  ultimoAdminUid,
  onEditar,
  onRestablecer,
  onDesactivar,
  onReactivar,
  className,
}: {
  usuarios: Usuario[];
  yoUid: string;
  /** uid del único admin activo, si solo queda uno. */
  ultimoAdminUid: string | null;
  onEditar: (u: Usuario) => void;
  onRestablecer: (u: Usuario) => void;
  onDesactivar: (u: Usuario) => void;
  onReactivar: (u: Usuario) => void;
  className?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<FiltroRol>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  const conteoRol = useMemo(() => {
    const c = { admin: 0, inter: 0, nacional: 0 };
    for (const u of usuarios) c[grupoDe(u.rol)]++;
    return c;
  }, [usuarios]);
  const pendientes = usuarios.filter((u) => {
    const e = estadoDe(u);
    return e === "Pendiente" || e === "Temporal vencida";
  }).length;

  const filas = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return usuarios
      .filter((u) => !q || sinTildes(u.nombre).includes(q) || sinTildes(u.email).includes(q))
      .filter((u) => filtroRol === "todos" || grupoDe(u.rol) === filtroRol)
      .filter((u) => {
        const e = estadoDe(u);
        if (filtroEstado === "activos") return e === "Activo";
        if (filtroEstado === "pendientes") return e === "Pendiente" || e === "Temporal vencida";
        if (filtroEstado === "inactivos") return e === "Inactivo";
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.uid === yoUid) - Number(a.uid === yoUid) ||
          Number(a.activo === false) - Number(b.activo === false) ||
          a.nombre.localeCompare(b.nombre),
      );
  }, [usuarios, busqueda, filtroRol, filtroEstado, yoUid]);

  return (
    <section className={cn(cardClass, "flex flex-col gap-3.5 p-0", className)}>
      <div className="flex flex-wrap items-center gap-2.5 px-[18px] pt-[18px]">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            aria-label="Buscar usuarios"
            className="h-9 pl-9"
          />
        </div>

        {/* Rol: segmentado; bajo 480px pasa a Select */}
        <ToggleGroup
          type="single"
          value={filtroRol}
          onValueChange={(v) => v && setFiltroRol(v as FiltroRol)}
          aria-label="Filtrar por rol"
          spacing={0.5}
          className={cn(grupoSegmentado, "max-[479px]:hidden")}
        >
          <ToggleGroupItem value="todos" className={segmento}>Todos</ToggleGroupItem>
          <ToggleGroupItem value="admin" className={segmento}>Admin <span className="font-mono">{conteoRol.admin}</span></ToggleGroupItem>
          <ToggleGroupItem value="inter" className={segmento}>Internacional <span className="font-mono">{conteoRol.inter}</span></ToggleGroupItem>
          <ToggleGroupItem value="nacional" className={segmento}>Nacional <span className="font-mono">{conteoRol.nacional}</span></ToggleGroupItem>
        </ToggleGroup>
        <Select value={filtroRol} onValueChange={(v) => setFiltroRol(v as FiltroRol)}>
          <SelectTrigger className="h-9 w-full min-[480px]:hidden" aria-label="Filtrar por rol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            <SelectItem value="admin">Admin ({conteoRol.admin})</SelectItem>
            <SelectItem value="inter">Internacional ({conteoRol.inter})</SelectItem>
            <SelectItem value="nacional">Nacional ({conteoRol.nacional})</SelectItem>
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          value={filtroEstado}
          onValueChange={(v) => v && setFiltroEstado(v as FiltroEstado)}
          aria-label="Filtrar por estado"
          spacing={0.5}
          className={grupoSegmentado}
        >
          <ToggleGroupItem value="todos" className={segmento}>Todos</ToggleGroupItem>
          <ToggleGroupItem value="activos" className={segmento}>Activos</ToggleGroupItem>
          <ToggleGroupItem value="pendientes" className={segmento}>
            Pendientes
            {pendientes > 0 && <span className="font-mono">{pendientes}</span>}
          </ToggleGroupItem>
          <ToggleGroupItem value="inactivos" className={segmento}>Inactivos</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-y border-border text-left text-xs text-muted-foreground">
              <th className="px-[18px] py-2.5 font-medium">Usuario</th>
              <th className="px-3 py-2.5 font-medium">Rol</th>
              <th className="px-3 py-2.5 font-medium">Estado</th>
              <th className="px-3 py-2.5 font-medium">Último acceso</th>
              <th className="px-[18px] py-2.5 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-[18px] py-10 text-center text-muted-foreground">
                  No hay usuarios que coincidan con la búsqueda o los filtros.
                </td>
              </tr>
            ) : (
              filas.map((u) => {
                const esYo = u.uid === yoUid;
                const estado = estadoDe(u);
                const bloqueoDesactivar = esYo
                  ? "No puedes desactivar tu propia cuenta"
                  : u.uid === ultimoAdminUid
                    ? "Es el único administrador activo"
                    : null;
                return (
                  <tr
                    key={u.uid}
                    className={cn("h-[58px] border-b border-border last:border-0", !u.activo && "opacity-60")}
                  >
                    <td className="px-[18px]">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-[34px] shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            claseAvatar(u.rol),
                          )}
                        >
                          {getInitials(u.nombre)}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <span className="truncate">{u.nombre}</span>
                            {esYo && (
                              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
                                Tú
                              </span>
                            )}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{etiquetaRol(u.rol)}</span>
                        {esRolValido(u.rol) && (
                          <span className="font-mono text-[11px] text-muted-foreground">{ROLES[u.rol].monedas}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-xs font-semibold",
                          CHIP[estado].clase,
                        )}
                        title={
                          estado === "Pendiente"
                            ? `Aún no cambia la contraseña temporal · creado el ${fechaCorta(u.fechaCreacion)}${u.creadoPor ? ` por ${u.creadoPor}` : ""}`
                            : estado === "Temporal vencida"
                              ? "La contraseña temporal venció sin usarse. Restablécela para darle acceso."
                              : undefined
                        }
                      >
                        <span className={cn("size-1.5 rounded-full", CHIP[estado].punto)} />
                        {estado}
                      </span>
                    </td>
                    <td className={cn("px-3", !u.ultimoAcceso && "text-muted-foreground")}>
                      {accesoRelativo(u.ultimoAcceso)}
                    </td>
                    <td className="px-[18px]">
                      <div className="flex items-center justify-end gap-1">
                        <Accion label={`Editar a ${u.nombre}`} tooltip="Editar" onClick={() => onEditar(u)}>
                          <Pencil className="size-4" />
                        </Accion>
                        <Accion
                          label={`Restablecer la contraseña de ${u.nombre}`}
                          tooltip="Restablecer contraseña"
                          onClick={() => onRestablecer(u)}
                          className="text-icon-amber"
                        >
                          <KeyRound className="size-4" />
                        </Accion>
                        {u.activo ? (
                          <Accion
                            label={`Desactivar a ${u.nombre}`}
                            tooltip={bloqueoDesactivar ?? "Desactivar"}
                            onClick={() => onDesactivar(u)}
                            disabled={Boolean(bloqueoDesactivar)}
                            className="text-danger-text"
                          >
                            <Ban className="size-4" />
                          </Accion>
                        ) : (
                          <Accion
                            label={`Reactivar a ${u.nombre}`}
                            tooltip="Reactivar"
                            onClick={() => onReactivar(u)}
                            className="text-success-text"
                          >
                            <UserCheck className="size-4" />
                          </Accion>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-[18px] py-3 text-xs text-muted-foreground">
        Mostrando {filas.length} de {usuarios.length} usuarios
      </p>
    </section>
  );
}
