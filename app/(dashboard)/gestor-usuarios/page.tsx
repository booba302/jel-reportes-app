"use client";

import { useMemo, useState } from "react";
import { Ban, KeyRound, RotateCw, Shield, ShieldAlert, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { cardClass } from "@/components/dashboard/CardHeading";
import { UsersTable } from "@/components/usuarios/UsersTable";
import { UserActivity } from "@/components/usuarios/UserActivity";
import { CreateUserDialog } from "@/components/usuarios/CreateUserDialog";
import { EditUserDialog } from "@/components/usuarios/EditUserDialog";
import { ConfirmDialog } from "@/components/usuarios/ConfirmDialog";
import { CredentialsResult, type Credenciales } from "@/components/usuarios/CredentialsResult";
import { useUsuarios } from "@/components/usuarios/useUsuarios";
import type { Usuario } from "@/components/usuarios/tipos";

export default function GestorUsuariosPage() {
  const { user, userData } = useAuth();
  const esAdmin = userData?.rol === "admin";
  const { usuarios, error, recargar } = useUsuarios(esAdmin);
  const [versionActividad, setVersionActividad] = useState(0);

  const [crearAbierto, setCrearAbierto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [restableciendo, setRestableciendo] = useState<Usuario | null>(null);
  const [desactivando, setDesactivando] = useState<Usuario | null>(null);
  const [credReset, setCredReset] = useState<Credenciales | null>(null);

  const refrescar = () => {
    recargar();
    setVersionActividad((v) => v + 1);
  };

  const r = useMemo(() => {
    const lista = usuarios ?? [];
    const admins = lista.filter((u) => u.rol === "admin");
    const adminsActivos = admins.filter((u) => u.activo);
    return {
      total: lista.length,
      activos: lista.filter((u) => u.activo).length,
      admins: admins.length,
      adminsActivos: adminsActivos.length,
      pendientes: lista.filter((u) => u.activo && u.debeCambiarPassword).length,
      inactivos: lista.filter((u) => !u.activo).length,
      ultimoAdminUid: adminsActivos.length === 1 ? adminsActivos[0].uid : null,
      correos: new Set(lista.map((u) => u.email.toLowerCase())),
    };
  }, [usuarios]);

  if (!esAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-3 px-4 py-20 text-center">
        <ShieldAlert className="size-12 text-danger-text" />
        <h1 className="text-xl font-semibold">Acceso denegado</h1>
        <p className="text-muted-foreground">Solo un administrador puede gestionar usuarios.</p>
      </div>
    );
  }

  const reactivar = async (u: Usuario) => {
    try {
      await apiFetch(`/api/usuarios/${u.uid}/estado`, {
        method: "POST",
        body: JSON.stringify({ activo: true }),
      });
      toast.success(`${u.nombre} vuelve a tener acceso`);
      refrescar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reactivar.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">Gestión de usuarios</h1>
          <p className="text-muted-foreground">Accesos, roles y contraseñas del equipo</p>
        </div>
        <Button
          onClick={() => setCrearAbierto(true)}
          className="h-9 gap-2 rounded-lg bg-action text-action-foreground hover:bg-action-hover"
        >
          <UserPlus className="size-4" />
          Nuevo usuario
        </Button>
      </div>

      {error ? (
        <section className={cn(cardClass, "flex flex-col items-center gap-3 py-12 text-center")}>
          <p className="text-muted-foreground">No se pudo cargar la lista de usuarios.</p>
          <Button variant="outline" className="gap-2" onClick={recargar}>
            <RotateCw className="size-4" />
            Reintentar
          </Button>
        </section>
      ) : !usuarios ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-xl" />
            ))}
          </div>
          <div className="flex flex-wrap gap-3.5">
            <Skeleton className="h-[420px] min-w-0 flex-[2.4_1_640px] rounded-xl" />
            <Skeleton className="h-[420px] min-w-0 flex-[1_1_300px] rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
            <KpiCard
              icon={Users}
              iconClassName="text-icon-blue"
              title="Usuarios activos"
              value={String(r.activos)}
              footer={`de ${r.total} registrados`}
            />
            <KpiCard
              icon={Shield}
              iconClassName="text-icon-violet"
              title="Administradores"
              value={String(r.admins)}
              footer={`${r.adminsActivos} ${r.adminsActivos === 1 ? "activo" : "activos"} · siempre debe quedar al menos 1`}
            />
            <KpiCard
              icon={KeyRound}
              iconClassName="text-icon-amber"
              title="Pendientes de primer ingreso"
              value={String(r.pendientes)}
              footer="Con contraseña temporal sin cambiar"
            />
            <KpiCard
              icon={Ban}
              iconClassName="text-icon-rose"
              title="Inactivos"
              value={String(r.inactivos)}
              footer="Sin acceso; su historial se conserva"
            />
          </div>

          <div className="flex flex-wrap items-start gap-3.5">
            <UsersTable
              className="min-w-0 flex-[2.4_1_640px]"
              usuarios={usuarios}
              yoUid={user?.uid ?? ""}
              ultimoAdminUid={r.ultimoAdminUid}
              onEditar={setEditando}
              onRestablecer={setRestableciendo}
              onDesactivar={setDesactivando}
              onReactivar={reactivar}
            />
            <UserActivity className="min-w-0 flex-[1_1_300px]" version={versionActividad} />
          </div>
        </>
      )}

      <CreateUserDialog
        open={crearAbierto}
        onOpenChange={setCrearAbierto}
        correosExistentes={r.correos}
        onCreado={refrescar}
      />

      {editando && (
        <EditUserDialog
          key={editando.uid}
          usuario={editando}
          esYo={editando.uid === user?.uid}
          esUltimoAdmin={editando.uid === r.ultimoAdminUid}
          onOpenChange={(o) => !o && setEditando(null)}
          onGuardado={refrescar}
        />
      )}

      <ConfirmDialog
        open={Boolean(restableciendo)}
        onOpenChange={(o) => !o && setRestableciendo(null)}
        titulo={`¿Restablecer la contraseña de ${restableciendo?.nombre ?? ""}?`}
        descripcion="Se genera una contraseña temporal nueva y se cierran sus sesiones abiertas. Al entrar, tendrá que elegir una propia."
        accion="Generar contraseña"
        tono="warning"
        onConfirmar={async () => {
          if (!restableciendo) return;
          try {
            const c = await apiFetch<Credenciales>(`/api/usuarios/${restableciendo.uid}/restablecer`, {
              method: "POST",
            });
            setCredReset({ nombre: c.nombre, email: c.email, password: c.password });
            refrescar();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo restablecer.");
            throw err;
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(desactivando)}
        onOpenChange={(o) => !o && setDesactivando(null)}
        titulo={`¿Desactivar a ${desactivando?.nombre ?? ""}?`}
        descripcion="No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus evaluaciones, cierres y su historial se conservan. Puedes reactivarlo cuando quieras."
        accion="Desactivar"
        tono="danger"
        onConfirmar={async () => {
          if (!desactivando) return;
          try {
            await apiFetch(`/api/usuarios/${desactivando.uid}/estado`, {
              method: "POST",
              body: JSON.stringify({ activo: false }),
            });
            toast.success(`${desactivando.nombre} ya no tiene acceso`);
            refrescar();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo desactivar.");
            throw err;
          }
        }}
      />

      {/* Contraseña restablecida: no se cierra por accidente mientras se muestra. */}
      <Dialog open={Boolean(credReset)}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-[480px]"
        >
          {credReset && (
            <CredentialsResult
              cred={credReset}
              titulo="Contraseña restablecida"
              onListo={() => setCredReset(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
