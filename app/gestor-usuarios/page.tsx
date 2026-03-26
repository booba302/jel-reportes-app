// src/app/gestor-usuarios/page.tsx
"use client";

import * as React from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "../context/AuthContext";

import {
  Users,
  UserPlus,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  X,
  Mail,
  Lock,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Ban,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  fechaCreacion?: string;
}

export default function GestorUsuariosPage() {
  const { userData } = useAuth();

  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modales
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<Usuario | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Formularios
  const [formData, setFormData] = React.useState({
    nombre: "",
    email: "",
    password: "",
    confirmPassword: "",
    rol: "agente_retiros_internacional",
  });
  const [resetData, setResetData] = React.useState({
    password: "",
    confirmPassword: "",
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

  // Evaluador de fuerza de contraseña
  const evaluarPassword = (pass: string) => {
    let score = 0;
    if (pass.length > 5) score += 1;
    if (pass.length > 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (pass.length === 0)
      return { width: "0%", color: "bg-slate-200", text: "" };
    if (score <= 2)
      return { width: "33%", color: "bg-rose-500", text: "Débil" };
    if (score <= 4)
      return { width: "66%", color: "bg-amber-500", text: "Buena" };
    return { width: "100%", color: "bg-emerald-500", text: "Fuerte" };
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return toast.warning("Las contraseñas no coinciden.");
    }
    if (formData.password.length < 6) {
      return toast.warning("La contraseña debe tener al menos 6 caracteres.");
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/crear-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      if (result.success) {
        toast.success("Usuario Creado exitosamente.");
        setIsModalOpen(false);
        setFormData({
          nombre: "",
          email: "",
          password: "",
          confirmPassword: "",
          rol: "agente_retiros_internacional",
        });
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
    if (resetData.password !== resetData.confirmPassword) {
      return toast.warning("Las contraseñas no coinciden.");
    }
    if (resetData.password.length < 6) {
      return toast.warning("La contraseña debe tener al menos 6 caracteres.");
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedUser.id,
          newPassword: resetData.password,
        }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success(`Contraseña actualizada para ${selectedUser.nombre}.`);
        setIsPasswordModalOpen(false);
        setResetData({ password: "", confirmPassword: "" });
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
    if (usr.rol === "admin") {
      return toast.error("No puedes desactivar a un administrador.");
    }

    const nuevoEstado = !usr.activo; // Invertimos el estado actual

    // Mostramos un loading en el toast mientras se comunica con el servidor
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
        await fetchUsuarios(); // Recargamos la tabla para ver el cambio
      } else {
        toast.error(result.error, { id: toastId });
      }
    } catch (error) {
      toast.error("Error de red al intentar cambiar el estado.", {
        id: toastId,
      });
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

  if (userData?.rol !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-500">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
      </div>
    );
  }

  const passStrength = evaluarPassword(formData.password);
  const resetPassStrength = evaluarPassword(resetData.password);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            Gestión de Usuarios
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
                        {/* Botón de Bloqueo/Desbloqueo (Solo visible si NO es admin) */}
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

                        {/* Botón de Cambiar Contraseña */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                          title="Cambiar contraseña"
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-slate-50 border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-primary" /> Crear Usuario
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="block w-full pl-10 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirmar
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className={cn(
                        "block w-full pl-3 pr-10 py-2 text-sm border rounded-lg outline-none focus:ring-2",
                        formData.confirmPassword &&
                          formData.password !== formData.confirmPassword
                          ? "border-rose-500 focus:ring-rose-500"
                          : "border-slate-300 focus:ring-primary",
                      )}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Indicador de Seguridad */}
              {formData.password && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Seguridad de la contraseña</span>
                    <span>{passStrength.text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        passStrength.color,
                      )}
                      style={{ width: passStrength.width }}
                    ></div>
                  </div>
                </div>
              )}

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
                    <option value="admin">Administrador (Acceso Total)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
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
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESETEAR CONTRASEÑA */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-amber-800 flex items-center">
                <KeyRound className="w-5 h-5 mr-2 text-amber-600" /> Nueva
                Contraseña
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-amber-600 hover:text-amber-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCambiarPassword} className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Ingresa la nueva credencial de acceso para{" "}
                <b>{selectedUser.nombre}</b>.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={resetData.password}
                    onChange={(e) =>
                      setResetData({ ...resetData, password: e.target.value })
                    }
                    className="block w-full pl-10 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={resetData.confirmPassword}
                    onChange={(e) =>
                      setResetData({
                        ...resetData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className={cn(
                      "block w-full pl-3 pr-10 py-2 text-sm border rounded-lg outline-none focus:ring-2",
                      resetData.confirmPassword &&
                        resetData.password !== resetData.confirmPassword
                        ? "border-rose-500 focus:ring-rose-500"
                        : "border-slate-300 focus:ring-amber-500",
                    )}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={resetData.confirmPassword}
                  onChange={(e) =>
                    setResetData({
                      ...resetData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className={cn(
                    "block w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2",
                    resetData.confirmPassword &&
                      resetData.password !== resetData.confirmPassword
                      ? "border-rose-500 focus:ring-rose-500"
                      : "border-slate-300 focus:ring-amber-500",
                  )}
                  placeholder="••••••••"
                />
              </div>

              {resetData.password && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Nivel de seguridad</span>
                    <span>{resetPassStrength.text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        resetPassStrength.color,
                      )}
                      style={{ width: resetPassStrength.width }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordModalOpen(false)}
                >
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
                    "Actualizar"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
