import type { Sesion } from "@/lib/authServer";
import { HttpError } from "@/lib/httpError";
import { getMonedasByRol, parseUserRole } from "@/lib/roles";

/**
 * Lanza 403 si quien llama no puede ver o tocar esa moneda.
 * GLOBAL (todas) solo vale en lecturas que lo admiten y solo para admin.
 */
export function exigirMoneda(yo: Sesion, moneda: string, { global = false } = {}) {
  if (moneda === "GLOBAL") {
    if (global && parseUserRole(yo.rol).isAdmin) return;
    throw new HttpError(403, "Solo un administrador puede ver todas las monedas.");
  }
  if (!getMonedasByRol(yo.rol).includes(moneda))
    throw new HttpError(403, "No tienes acceso a esa moneda.");
}
