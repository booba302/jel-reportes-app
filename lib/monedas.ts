import type { Currency } from "@/app/context/CurrencyContext";

/** Monedas que puede ver cada rol (GLOBAL es exclusivo de admin). */
export function monedasPermitidas(rol: string): Currency[] {
  const normalizedRol = rol.toLowerCase().trim();

  if (normalizedRol.includes("admin"))
    return ["GLOBAL", "PEN", "CLP", "MXN", "USD", "VES"];

  if (normalizedRol.includes("internacional") || normalizedRol.includes("inter"))
    return ["PEN", "CLP", "MXN", "USD"];

  // Si llega hasta aquí, es porque es 100% "nacional" y no "internacional"
  if (normalizedRol.includes("nacional")) return ["VES"];

  // Fallback por defecto (sin GLOBAL, que es exclusivo de admin)
  return ["PEN", "CLP", "MXN", "USD"];
}
