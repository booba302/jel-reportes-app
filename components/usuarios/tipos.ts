import { differenceInCalendarDays, differenceInMinutes, format } from "date-fns";
import { es } from "date-fns/locale";

/** Fila de `GET /api/usuarios`. */
export type Usuario = {
  uid: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  debeCambiarPassword: boolean;
  tempPassExpira: string | null;
  fechaCreacion: string | null;
  creadoPor: string | null;
  ultimoAcceso: string | null;
};

export type Estado = "Activo" | "Pendiente" | "Temporal vencida" | "Inactivo";

export function estadoDe(u: Usuario, ahora = Date.now()): Estado {
  if (!u.activo) return "Inactivo";
  if (!u.debeCambiarPassword) return "Activo";
  if (u.tempPassExpira && new Date(u.tempPassExpira).getTime() < ahora) return "Temporal vencida";
  return "Pendiente";
}

/** Para buscar sin tildes ni mayúsculas. */
export const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "Hace 25 min", "Hace 4 h", "Ayer", "Hace 3 días", "12 sep 2026"; "Nunca" si no hay. */
export function accesoRelativo(iso: string | null, ahora = new Date()) {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const min = differenceInMinutes(ahora, d);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const dias = differenceInCalendarDays(ahora, d);
  if (dias === 0) return `Hace ${Math.floor(min / 60)} h`;
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  return format(d, "d MMM yyyy", { locale: es });
}

/** "Ahora", "Hace 15 min", "Ayer, 16:40" o "2 oct, 09:12" (actividad reciente). */
export function fechaActividad(iso: string, ahora = new Date()) {
  const d = new Date(iso);
  const min = differenceInMinutes(ahora, d);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const dias = differenceInCalendarDays(ahora, d);
  if (dias === 0) return `Hoy, ${format(d, "HH:mm")}`;
  if (dias === 1) return `Ayer, ${format(d, "HH:mm")}`;
  return format(d, "d MMM, HH:mm", { locale: es });
}

export const fechaCorta = (iso: string | null) =>
  iso ? format(new Date(iso), "d MMM yyyy", { locale: es }) : "—";

/** Mensaje para enviar por un canal privado (§22.4). */
export const mensajeCredenciales = (c: { nombre: string; email: string; password: string }) =>
  `Hola ${c.nombre}, ya tienes acceso a PayoutMetrics.\n` +
  `Usuario: ${c.email}\n` +
  `Contraseña temporal: ${c.password}\n` +
  `Vence en 72 horas. Al entrar, el sistema te pedirá elegir una propia.`;
