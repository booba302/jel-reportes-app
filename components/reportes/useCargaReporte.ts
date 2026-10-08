"use client";

import { authHeaders } from "@/lib/apiFetch";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { formatEntero } from "@/lib/format";
import { diaCorto } from "./fechas";

export type FaseCarga =
  | "cerrado"
  | "sincronizando"
  | "guardando"
  | "falla"
  | "procesando";

export type FallaCarga = {
  titulo: string;
  descripcion: string;
  detalle?: string;
};

type Opciones = {
  currency: string;
  subidoPor: string;
  rol: string;
  hoy: string; // "YYYY-MM-DD"
  /** Se llama tras guardar con éxito (refrescar mes, invalidar caché, seleccionar día). */
  onCargado: (dia: string) => void;
};

export function useCargaReporte({
  currency,
  subidoPor,
  rol,
  hoy,
  onCargado,
}: Opciones) {
  const [fase, setFase] = useState<FaseCarga>("cerrado");
  const [dia, setDia] = useState<string | null>(null);
  const [falla, setFalla] = useState<FallaCarga | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const terminar = useCallback(
    (d: string, total: number) => {
      toast.success(`Reporte del ${diaCorto(d)} cargado`, {
        description: `${formatEntero(total)} retiros guardados`,
      });
      setFase("cerrado");
      setArchivo(null);
      setFalla(null);
      onCargado(d);
    },
    [onCargado],
  );

  const sincronizar = useCallback(
    async (d: string) => {
      const abort = new AbortController();
      abortRef.current = abort;
      setFase("sincronizando");
      setFalla(null);

      const fallaApi = (detalle?: string): FallaCarga => ({
        titulo: "Fallo al conectar con el API",
        descripcion: `No se obtuvo respuesta para el ${diaCorto(d)}. Puedes intentar de nuevo o cargar el archivo Excel de ese día.`,
        detalle,
      });

      try {
        const fd = new FormData();
        fd.append("currency", currency);
        fd.append("subidoPor", subidoPor);
        fd.append("rol", rol);
        fd.append("fecha", d);

        const res = await fetch("/api/fetch-api-reporte", {
          method: "POST",
          body: fd,
          headers: await authHeaders(),
          signal: abort.signal,
        });
        const json = await res.json().catch(() => null);
        if (abort.signal.aborted) return;

        if (!res.ok || !json?.success) {
          setFalla(fallaApi(json?.error));
          setFase("falla");
          return;
        }

        // El servidor ya guardó el día al responder.
        const total = Number(json.totalRegistros) || 0;
        if (total === 0) {
          setFalla({
            titulo: "El API no devolvió retiros",
            descripcion: `El API no devolvió retiros para el ${diaCorto(d)}. Puedes intentar de nuevo o cargar el archivo Excel de ese día.`,
          });
          setFase("falla");
          return;
        }
        terminar(d, total);
      } catch (err) {
        if (abort.signal.aborted) return;
        console.error("Error en la carga por API:", err);
        setFalla(fallaApi(err instanceof Error ? err.message : undefined));
        setFase("falla");
      } finally {
        if (abortRef.current === abort) abortRef.current = null;
      }
    },
    [currency, subidoPor, rol, terminar],
  );

  /** Abre el modal para un día y arranca la sincronización con el API. */
  const abrir = useCallback(
    (d: string) => {
      // Barrera del cliente: nunca hoy ni días futuros (p. ej. un ?dia= manipulado).
      if (d >= hoy) {
        toast.error("No se puede cargar el día en curso ni días futuros.");
        return;
      }
      setDia(d);
      setArchivo(null);
      sincronizar(d);
    },
    [hoy, sincronizar],
  );

  const reintentar = useCallback(() => {
    if (dia) sincronizar(dia);
  }, [dia, sincronizar]);

  const cancelar = useCallback(() => {
    if (fase === "guardando" || fase === "procesando") return;
    abortRef.current?.abort();
    abortRef.current = null;
    setFase("cerrado");
    setFalla(null);
    setArchivo(null);
  }, [fase]);

  const procesarArchivo = useCallback(async () => {
    if (!dia || !archivo) return;
    setFase("procesando");
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("currency", currency);
      fd.append("subidoPor", subidoPor);
      fd.append("rol", rol);
      fd.append("fechaEsperada", dia);

      const res = await fetch("/api/upload-reporte", {
        method: "POST",
        body: fd,
        headers: await authHeaders(),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setFalla({
          titulo: "No se pudo procesar el archivo",
          descripcion:
            json?.error ?? "Revisa que sea el reporte correcto e inténtalo de nuevo.",
        });
        setFase("falla"); // se conserva el archivo para reintentar
        return;
      }
      terminar(dia, Number(json.totalRegistros) || 0);
    } catch (err) {
      console.error("Error procesando archivo:", err);
      setFalla({
        titulo: "No se pudo procesar el archivo",
        descripcion: "Error de red al subir el archivo. Inténtalo de nuevo.",
      });
      setFase("falla");
    }
  }, [dia, archivo, currency, subidoPor, rol, terminar]);

  return {
    fase,
    dia,
    falla,
    archivo,
    setArchivo,
    abrir,
    reintentar,
    cancelar,
    procesarArchivo,
  };
}
