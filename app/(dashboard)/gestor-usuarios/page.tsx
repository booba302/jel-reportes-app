// src/app/gestor-usuarios/page.tsx
"use client";

import * as React from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";

import {
  Users,
  UserPlus,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  X,
  Mail,
  Shield,
  KeyRound,
  Ban,
  UserCheck,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
}

export default function GestorUsuariosPage() {
  const { userData } = useAuth();

  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<Usuario | null>(null);

  // Estado para mostrar las credenciales recién generadas
  const [newCredentials, setNewCredentials] = React.useState<{
    email: string;
    pass: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Formularios simplificados (sin contraseñas)
  const [formData, setFormData] = React.useState({
    nombre: "",
    email: "",
    rol: "agente_retiros_internacional",
  });

  const fetchUsuarios = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const data: Usuario[] = [];
      snap.forEach((doc) =>
        data.push({ id: doc.id, ...doc.data() } as Usuario),
      );
      data.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setUsuarios(data);
    } catch (error) {
      toast.error("Error al cargar la lista de usuarios.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (userData?.rol === "admin") fetchUsuarios();
  }, [userData]);

  // Generador de contraseñas seguras de 8 caracteres
  const generarPassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%*";
    let pass = "";
    for (let i = 0; i < 8; i++)
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    return pass;
  };

  const handleCopiarCredenciales = () => {
    if (!newCredentials) return;
    const texto = `Hola, tus credenciales de acceso al sistema son:\n\nUsuario: ${newCredentials.email}\nContraseña temporal: ${newCredentials.pass}\n\nNota: El sistema te pedirá cambiar esta contraseña al ingresar por primera vez.`;
    navigator.clipboard.writeText(texto);
    setCopied(true);
    toast.success("Credenciales copiadas al portapapeles");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const passTemporal = generarPassword();

    try {
      const response = await fetch("/api/crear-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, password: passTemporal }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success("Usuario Creado exitosamente.");
        setNewCredentials({ email: formData.email, pass: passTemporal });
        await fetchUsuarios();
      } else {
        toast.error("Error", { description: result.error });
      }
    } catch (error) {
      toast.error("Error de red.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    const passTemporal = generarPassword();

    try {
      const response = await fetch("/api/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedUser.id,
          newPassword: passTemporal,
        }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success(`Contraseña actualizada para ${selectedUser.nombre}.`);
        setNewCredentials({ email: selectedUser.email, pass: passTemporal });
      } else {
        toast.error("Error", { description: result.error });
      }
    } catch (error) {
      toast.error("Error de red.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEstado = async (usr: Usuario) => {
    if (usr.rol === "admin")
      return toast.error("No puedes desactivar a un administrador.");
    const nuevoEstado = !usr.activo;
    const toastId = toast.loading(
      `${nuevoEstado ? "Activando" : "Desactivando"} usuario...`,
    );

    try {
      const response = await fetch("/api/toggle-estado-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: usr.id,
          activo: nuevoEstado,
          rol: usr.rol,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(result.message, { id: toastId });
        await fetchUsuarios();
      } else toast.error(result.error, { id: toastId });
    } catch (error) {
      toast.error("Error de red.", { id: toastId });
    }
  };

  const formatearRol = (rol: string) => {
    switch (rol) {
      case "admin":
        return "Administrador";
      case "agente_retiros_internacional":
        return "Agente Internacional";
      case "agente_retiros_nacional":
        return "Agente Nacional";
      default:
        return rol.replace(/_/g, " ");
    }
  };

  // Función para cerrar modal y limpiar credenciales temporales
  const cerrarModal = () => {
    setIsModalOpen(false);
    setIsPasswordModalOpen(false);
    setNewCredentials(null);
    setFormData({ nombre: "", email: "", rol: "agente_retiros_internacional" });
  };

  if (userData?.rol !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-500">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
      </div>
    );
  }

  // Componente reutilizable para mostrar credenciales
  const CredencialesGeneradas = () => (
    <div className="p-6 space-y-6 animate-in zoom-in-95 duration-300">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          ¡Operación Exitosa!
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Comparte estas credenciales con el agente.
        </p>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm space-y-2">
        <div className="flex justify-between border-b pb-2">
          <span className="text-slate-500">Usuario:</span>
          <span className="font-bold text-slate-800">
            {newCredentials?.email}
          </span>
        </div>
        <div className="flex justify-between pt-1">
          <span className="text-slate-500">Contraseña temporal:</span>
          <span className="font-bold text-rose-600">
            {newCredentials?.pass}
          </span>
        </div>
      </div>

      <Button
        onClick={handleCopiarCredenciales}
        className={cn(
          "w-full h-12 text-base transition-all",
          copied
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-primary hover:bg-primary/90",
        )}
      >
        {copied ? (
          <>
            <Check className="w-5 h-5 mr-2" /> Copiado
          </>
        ) : (
          <>
            <Copy className="w-5 h-5 mr-2" /> Copiar para enviar
          </>
        )}
      </Button>

      <Button
        variant="ghost"
        onClick={cerrarModal}
        className="w-full text-slate-500"
      >
        Cerrar ventana
      </Button>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" /> Gestión de Usuarios
          </h1>
          <p className="text-slate-500 mt-1">
            Administra los accesos y roles de tu equipo.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white shadow-sm"
        >
          <UserPlus className="h-4 w-4 mr-2" /> Nuevo Usuario
        </Button>
      </div>

      <Card>
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-lg">Directorio de Accesos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-6 font-semibold">Empleado</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead className="text-center">Rol</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right pr-6">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : usuarios.length > 0 ? (
                usuarios.map((usr) => (
                  <TableRow key={usr.id}>
                    <TableCell className="pl-6 font-medium text-slate-800">
                      {usr.nombre}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {usr.email}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full border",
                          usr.rol === "admin"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200",
                        )}
                      >
                        {formatearRol(usr.rol)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {usr.activo ? (
                        <div className="inline-flex items-center text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Activo
                        </div>
                      ) : (
                        <div className="inline-flex items-center text-xs font-medium text-rose-600">
                          <X className="w-3 h-3 mr-1" /> Inactivo
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        {usr.rol !== "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              usr.activo
                                ? "text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                            }
                            title={
                              usr.activo
                                ? "Desactivar acceso"
                                : "Activar acceso"
                            }
                            onClick={() => handleToggleEstado(usr)}
                          >
                            {usr.activo ? (
                              <Ban className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                          title="Restablecer contraseña"
                          onClick={() => {
                            setSelectedUser(usr);
                            setIsPasswordModalOpen(true);
                          }}
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-slate-500"
                  >
                    No hay usuarios registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL CREAR USUARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-primary" /> Crear Usuario
              </h3>
              {!newCredentials && (
                <button
                  onClick={cerrarModal}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {newCredentials ? (
              <CredencialesGeneradas />
            ) : (
              <form onSubmit={handleCrearUsuario} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Users className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rol del Sistema
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Shield className="h-4 w-4 text-slate-400" />
                    </div>
                    <select
                      required
                      value={formData.rol}
                      onChange={(e) =>
                        setFormData({ ...formData, rol: e.target.value })
                      }
                      className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                    >
                      <option value="agente_retiros_internacional">
                        Agente de Retiros (Internacional)
                      </option>
                      <option value="agente_retiros_nacional">
                        Agente de Retiros (Nacional)
                      </option>
                      <option value="admin">
                        Administrador (Acceso Total)
                      </option>
                    </select>
                  </div>
                </div>
                <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-xs mt-2 border border-amber-200">
                  <span className="font-bold">Nota:</span> El sistema generará
                  automáticamente una contraseña temporal y segura.
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                  <Button type="button" variant="outline" onClick={cerrarModal}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      "Generar Credenciales"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL RESETEAR CONTRASEÑA */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-amber-800 flex items-center">
                <KeyRound className="w-5 h-5 mr-2 text-amber-600" /> Restablecer
                Acceso
              </h3>
              {!newCredentials && (
                <button
                  onClick={cerrarModal}
                  className="text-amber-600 hover:text-amber-800"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {newCredentials ? (
              <CredencialesGeneradas />
            ) : (
              <form onSubmit={handleCambiarPassword} className="p-6 space-y-4">
                <p className="text-sm text-slate-600 text-center">
                  ¿Estás seguro de que deseas revocar la contraseña actual de{" "}
                  <b>{selectedUser.nombre}</b> y generar una nueva?
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                  <Button type="button" variant="outline" onClick={cerrarModal}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      "Sí, generar nueva"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
