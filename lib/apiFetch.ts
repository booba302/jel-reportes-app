import { auth } from "@/lib/firebase";

/**
 * Toda llamada a `/api/*` pasa por aquí para enviar el token de Firebase.
 * Lanza un Error con el mensaje del servidor si la respuesta no es exitosa.
 */
export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const esFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(esFormData || !init.body ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error ?? "Error de red.");
  return data as T;
}

/** Encabezado con el token, para las llamadas que leen la respuesta por su cuenta (p. ej. FormData). */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
