import { randomInt } from "node:crypto";

/** Vigencia de la contraseña temporal. */
export const HORAS_TEMPORAL = 72;

// Sin caracteres ambiguos: 0 O 1 l I
const MAYUS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUS = "abcdefghijkmnpqrstuvwxyz";
const DIGITOS = "23456789";
const A = MAYUS + MINUS + DIGITOS;

const al = (s: string) => s[randomInt(s.length)];

/**
 * 12 caracteres en 3 bloques: "Xk7m-Qp4r-Tz9w". Siempre trae mayúscula, minúscula
 * y número, para cumplir una política de contraseñas de Firebase. Solo servidor.
 */
export function passwordTemporal() {
  const c = [al(MAYUS), al(MINUS), al(DIGITOS), ...Array.from({ length: 9 }, () => al(A))];
  // Fisher–Yates con crypto: los caracteres obligatorios no quedan en posiciones fijas.
  for (let i = c.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [c[i], c[j]] = [c[j], c[i]];
  }
  const s = c.join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export const vencimientoTemporal = (desde = new Date()) =>
  new Date(desde.getTime() + HORAS_TEMPORAL * 3600_000).toISOString();
