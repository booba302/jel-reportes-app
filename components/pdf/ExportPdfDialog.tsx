"use client";

import { useState, type ReactNode } from "react";
import { Download, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HEX_FONDO,
  HEX_TONO,
  MARCA,
  textoCelda,
  type Bloque,
  type Celda,
  type DocumentoPdf,
  generarPdf,
} from "./documento";

const estiloCelda = (c: Celda) =>
  typeof c === "string"
    ? undefined
    : {
        color: c.tono ? HEX_TONO[c.tono] : undefined,
        backgroundColor: c.fondo ? HEX_FONDO[c.fondo] : undefined,
      };

function BloquePreview({ b }: { b: Bloque }) {
  if (b.tipo === "cajas")
    return (
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${b.cajas.length}, minmax(0, 1fr))` }}
      >
        {b.cajas.map((c) => (
          <div key={c.label} className="rounded-md border border-[#E2E2E2] p-2">
            <div className="text-[10px] text-[#666]">{c.label}</div>
            <div
              className="truncate text-[13px] font-bold"
              style={c.tono ? { color: HEX_TONO[c.tono] } : undefined}
            >
              {c.valor}
            </div>
            {c.sub && <div className="truncate text-[9px] text-[#666]">{c.sub}</div>}
          </div>
        ))}
      </div>
    );

  if (b.tipo === "tabla")
    return (
      <div className="flex flex-col gap-1">
        {b.titulo && <span className="text-[12px] font-bold">{b.titulo}</span>}
        <table
          className={cn(
            "w-full border-collapse",
            b.compacta ? "border-separate border-spacing-[1px] text-center text-[8px]" : "text-[10px]",
          )}
        >
          <thead>
            <tr className={cn("bg-[#F2F2F2]", !b.compacta && "text-left")}>
              {b.cabecera.map((c) => (
                <th key={c} className={cn("font-semibold", b.compacta ? "px-0.5 py-0.5" : "px-1.5 py-1")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.filas.length === 0 ? (
              <tr className="border-b border-[#EDEDED]">
                <td colSpan={b.cabecera.length} className="px-1.5 py-1 text-[#666]">
                  {b.vacio ?? "Sin datos."}
                </td>
              </tr>
            ) : (
              b.filas.map((f, i) => (
                <tr key={i} className={cn(!b.compacta && "border-b border-[#EDEDED]")}>
                  {f.map((c, j) => (
                    <td
                      key={j}
                      className={cn(
                        b.compacta ? "px-0.5 py-0.5" : "px-1.5 py-1",
                        typeof c !== "string" && c.negrita && "font-bold",
                      )}
                      style={estiloCelda(c)}
                    >
                      {textoCelda(c)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );

  if (b.tipo === "notas")
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-bold">{b.titulo}</span>
        {b.items.length === 0 ? (
          <span className="text-[#666]">{b.vacio}</span>
        ) : (
          b.items.map((it, i) => (
            <span key={i} className="whitespace-pre-line">
              {it.etiqueta && <strong>{it.etiqueta}:</strong>} {it.texto}
            </span>
          ))
        )}
      </div>
    );

  return (
    <span
      className={cn(b.negrita && "font-bold")}
      style={b.tono ? { color: HEX_TONO[b.tono] } : undefined}
    >
      {b.texto}
    </span>
  );
}

/** Hoja blanca fija con el mismo contenido que tendrá el PDF. */
function PdfPreview({ doc }: { doc: DocumentoPdf }) {
  const horizontal = doc.orientacion === "horizontal";
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-4 bg-white p-8 text-[11px] text-[#171717] shadow-lg",
        horizontal ? "min-w-[860px] max-w-[1000px]" : "min-w-[640px] max-w-[720px]",
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b-2 border-[#171717] pb-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-auto w-8" />
          <div className="flex flex-col">
            <span className="text-[15px] font-bold">{doc.titulo}</span>
            <span className="text-[#666]">{doc.subtitulo}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-[#666]">
          <span>{MARCA}</span>
          {doc.estado && (
            <span
              className="font-bold"
              style={{ color: HEX_TONO[doc.estado.tono ?? "suave"] }}
            >
              {doc.estado.texto}
            </span>
          )}
        </div>
      </div>

      {doc.bloques.map((b, i) => (
        <BloquePreview key={i} b={b} />
      ))}

      <div className="flex flex-col gap-0.5 border-t border-[#EDEDED] pt-2 text-[10px] text-[#666]">
        {doc.pie.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Diálogo común de exportación: vista previa de la hoja + "Descargar PDF".
 * `aviso` se muestra arriba de la vista previa (p. ej. pendientes o PRELIMINAR).
 */
export function ExportPdfDialog({
  open,
  onOpenChange,
  titulo,
  doc,
  aviso,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  doc: DocumentoPdf | null;
  aviso?: ReactNode;
}) {
  const [generando, setGenerando] = useState(false);
  const horizontal = doc?.orientacion === "horizontal";

  const descargar = async () => {
    if (!doc) return;
    setGenerando(true);
    try {
      const nombre = await generarPdf(doc);
      toast.success(`${nombre} descargado`);
      onOpenChange(false);
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Hubo un problema al generar el PDF.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !generando && onOpenChange(o)}>
      <DialogContent
        className={cn(
          "max-h-[92dvh] max-w-[calc(100%-2rem)] grid-rows-[auto_auto_1fr_auto] gap-4 p-5",
          horizontal ? "sm:max-w-[1100px]" : "sm:max-w-[860px]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{titulo}</DialogTitle>
          <DialogDescription>
            Vista previa · A4 {horizontal ? "horizontal" : "vertical"} · siempre en tema claro
          </DialogDescription>
        </DialogHeader>

        {aviso ? (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-text">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            <span>{aviso}</span>
          </div>
        ) : (
          <span />
        )}

        <div className="min-h-0 overflow-auto rounded-lg bg-muted p-4">
          {doc && <PdfPreview doc={doc} />}
        </div>

        <DialogFooter className="-mx-5 -mb-5 px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generando}>
            Cancelar
          </Button>
          <Button
            onClick={descargar}
            disabled={generando || !doc}
            className="gap-2 bg-action text-action-foreground hover:bg-action-hover"
          >
            {generando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
