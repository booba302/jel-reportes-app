"use client";

import { useRef, useState } from "react";
import {
  CircleAlert,
  FileSpreadsheet,
  Loader2,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDecimal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FaseCarga, FallaCarga } from "./useCargaReporte";
import { diaCorto, diaLargo } from "./fechas";

const botonAccion =
  "gap-2 rounded-lg bg-action text-action-foreground hover:bg-action-hover";

const esExcel = (f: File) => /\.(xlsx|xls)$/i.test(f.name);

function tamano(bytes: number) {
  if (bytes >= 1024 * 1024) return `${formatDecimal(bytes / 1024 / 1024)} MB`;
  return `${formatDecimal(bytes / 1024)} KB`;
}

function Dropzone({
  dia,
  onArchivo,
  disabled,
}: {
  dia: string;
  onArchivo: (f: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [invalido, setInvalido] = useState(false);

  const elegir = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!esExcel(f)) {
      setInvalido(true);
      return;
    }
    setInvalido(false);
    onArchivo(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        if (!disabled) elegir(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-input p-6 text-center transition-colors",
        encima && "border-action bg-day-today-bg",
      )}
    >
      <Upload className="size-5 text-muted-foreground" />
      <span className="text-sm font-medium">Arrastra el archivo o selecciónalo</span>
      <span className="font-mono text-xs text-muted-foreground">
        solo .xlsx o .xls · del {diaCorto(dia)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 rounded-lg"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Seleccionar archivo
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={(e) => {
          elegir(e.target.files);
          e.target.value = "";
        }}
      />
      {invalido && (
        <span className="text-xs text-danger-text">
          Solo se aceptan archivos .xlsx o .xls.
        </span>
      )}
    </div>
  );
}

export function CargaReporteDialog({
  fase,
  dia,
  falla,
  archivo,
  setArchivo,
  reintentar,
  cancelar,
  procesarArchivo,
}: {
  fase: FaseCarga;
  dia: string | null;
  falla: FallaCarga | null;
  archivo: File | null;
  setArchivo: (f: File | null) => void;
  reintentar: () => void;
  cancelar: () => void;
  procesarArchivo: () => void;
}) {
  const ocupado = fase === "guardando" || fase === "procesando";

  return (
    <Dialog
      open={fase !== "cerrado"}
      onOpenChange={(open) => {
        if (!open) cancelar();
      }}
    >
      <DialogContent
        showCloseButton={!ocupado}
        onInteractOutside={(e) => ocupado && e.preventDefault()}
        onEscapeKeyDown={(e) => ocupado && e.preventDefault()}
        className="max-w-[calc(100%-2rem)] gap-5 p-5 sm:max-w-[460px]"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Cargar reporte
          </DialogTitle>
          <DialogDescription>{dia ? diaLargo(dia) : ""}</DialogDescription>
        </DialogHeader>

        {(fase === "sincronizando" || fase === "guardando") && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <Loader2 className="size-[30px] animate-spin text-day-today-text" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">
                {fase === "guardando"
                  ? "Guardando retiros…"
                  : "Extrayendo retiros del API…"}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {fase === "guardando"
                  ? "No cierres esta ventana hasta que termine."
                  : "Esto puede tomar hasta un minuto."}
              </span>
            </div>
            <Progress
              value={fase === "guardando" ? 100 : 90}
              className="h-1.5 bg-track"
              indicatorClassName={cn(
                "bg-action",
                fase === "sincronizando" && "animate-carga-progreso",
              )}
            />
          </div>
        )}

        {(fase === "falla" || fase === "procesando") && dia && (
          <div className="flex flex-col gap-4">
            {falla && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px]"
              >
                <CircleAlert className="mt-px size-4 shrink-0 text-danger-text" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-danger-text">
                    {falla.titulo}
                  </span>
                  <span className="text-muted-foreground">{falla.descripcion}</span>
                  {falla.detalle && (
                    <span className="text-xs text-muted-foreground">
                      {falla.detalle}
                    </span>
                  )}
                </div>
              </div>
            )}

            <Button
              className={cn(botonAccion, "h-10 w-full")}
              onClick={reintentar}
              disabled={ocupado}
            >
              <RotateCw className="size-4" />
              Intentar de nuevo
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />o carga por archivo
              <span className="h-px flex-1 bg-border" />
            </div>

            {archivo ? (
              <div className="flex items-center gap-3 rounded-[10px] border border-border px-3.5 py-3">
                <FileSpreadsheet className="size-5 shrink-0 text-success" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium" title={archivo.name}>
                    {archivo.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {tamano(archivo.size)} · listo para procesar
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Quitar archivo"
                  disabled={ocupado}
                  onClick={() => setArchivo(null)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Dropzone dia={dia} onArchivo={setArchivo} disabled={ocupado} />
            )}
          </div>
        )}

        <DialogFooter className="-mx-5 -mb-5 px-5 py-4">
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={cancelar}
            disabled={ocupado}
          >
            Cancelar
          </Button>
          {(fase === "falla" || fase === "procesando") && (
            <Button
              className={botonAccion}
              onClick={procesarArchivo}
              disabled={!archivo || ocupado}
            >
              {fase === "procesando" && <Loader2 className="size-4 animate-spin" />}
              {fase === "procesando" ? "Procesando…" : "Procesar archivo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
