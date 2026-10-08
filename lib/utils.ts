import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isExonerated(comentarioBrecha?: string): boolean {
  return Boolean(comentarioBrecha && comentarioBrecha.trim() !== "");
}

/** "Franklin Rivas" → "FR" (primeras letras de las dos primeras palabras). */
export function getInitials(nombre?: string | null): string {
  if (!nombre) return "";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
