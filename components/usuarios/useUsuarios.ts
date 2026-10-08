"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { subDays } from "date-fns";
import { db } from "@/lib/firebase";
import { apiFetch } from "@/lib/apiFetch";
import type { Usuario } from "./tipos";

/** Lista de usuarios (con último acceso, que solo sale de Auth vía la API). */
export function useUsuarios(habilitado: boolean) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!habilitado) return;
    let cancelado = false;
    apiFetch<{ usuarios: Usuario[] }>("/api/usuarios")
      .then((r) => {
        if (cancelado) return;
        setUsuarios(r.usuarios);
        setError(false);
      })
      .catch((e) => {
        console.error("Error al cargar usuarios:", e);
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, [habilitado, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { usuarios, error, recargar };
}

export type Actividad = {
  id: string;
  accion: "crear" | "editar" | "rol" | "restablecer" | "desactivar" | "reactivar" | "cambio_password";
  objetivoUid: string;
  objetivoNombre: string;
  porNombre: string;
  el: string;
  detalle?: { rolAnterior?: string; rolNuevo?: string; nombreAnterior?: string };
};

/** Registro de `auditoria_usuarios` de los últimos 30 días, del más nuevo al más viejo. */
export function useActividad(habilitado: boolean, max: number, version: number) {
  const [items, setItems] = useState<Actividad[] | null>(null);

  useEffect(() => {
    if (!habilitado) return;
    let cancelado = false;
    getDocs(
      query(
        collection(db, "auditoria_usuarios"),
        where("el", ">=", subDays(new Date(), 30).toISOString()),
        orderBy("el", "desc"),
        limit(max),
      ),
    )
      .then((snap) => {
        if (!cancelado) setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Actividad));
      })
      .catch((e) => {
        console.error("Error al cargar la actividad de usuarios:", e);
        if (!cancelado) setItems([]);
      });
    return () => {
      cancelado = true;
    };
  }, [habilitado, max, version]);

  return items;
}
