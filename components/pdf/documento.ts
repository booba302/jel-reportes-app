import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { UMBRAL_BUENA, UMBRAL_REVISAR } from "@/lib/evaluacion";

/**
 * Documento PDF descrito como datos: la vista previa (PdfPreview) y el
 * archivo (generarPdf) salen de la misma descripción, así siempre coinciden.
 * Colores fijos: el PDF siempre sale en tema claro.
 */

export type Tono = "buena" | "revisar" | "mala" | "suave";

export const RGB_TONO: Record<Tono, [number, number, number]> = {
  buena: [21, 128, 61],
  revisar: [138, 75, 0],
  mala: [190, 18, 60],
  suave: [102, 102, 102],
};

export const HEX_TONO: Record<Tono, string> = {
  buena: "#15803D",
  revisar: "#8A4B00",
  mala: "#BE123C",
  suave: "#666666",
};

/** Fondo de celda (mapa de calor del monitor). */
export type Fondo = "buena" | "revisar" | "mala" | "vacio";

export const RGB_FONDO: Record<Fondo, [number, number, number]> = {
  buena: [187, 232, 204],
  revisar: [250, 222, 170],
  mala: [248, 196, 206],
  vacio: [242, 242, 242],
};

export const HEX_FONDO: Record<Fondo, string> = {
  buena: "#BBE8CC",
  revisar: "#FADEAA",
  mala: "#F8C4CE",
  vacio: "#F2F2F2",
};

export const tonoNota = (n: number): Tono =>
  n >= UMBRAL_BUENA ? "buena" : n >= UMBRAL_REVISAR ? "revisar" : "mala";

export type Celda = string | { texto: string; tono?: Tono; negrita?: boolean; fondo?: Fondo };

export type Caja = { label: string; valor: string; sub?: string; tono?: Tono };

export type Bloque =
  | { tipo: "cajas"; cajas: Caja[] }
  | {
      tipo: "tabla";
      titulo?: string;
      cabecera: string[];
      filas: Celda[][];
      vacio?: string;
      /** Letra chica, centrada y con bordes blancos (p. ej. mapa de calor). */
      compacta?: boolean;
    }
  | {
      tipo: "notas";
      titulo: string;
      items: { etiqueta?: string; texto: string }[];
      vacio: string;
    }
  | { tipo: "texto"; texto: string; negrita?: boolean; tono?: Tono };

export type DocumentoPdf = {
  nombreArchivo: string;
  orientacion?: "vertical" | "horizontal";
  titulo: string;
  subtitulo: string;
  /** Debajo de la marca, a la derecha (p. ej. "Mes cerrado" o "PRELIMINAR"). */
  estado?: { texto: string; tono?: Tono };
  bloques: Bloque[];
  /** Líneas al pie de cada página (fórmula, "Generado por…"). */
  pie: string[];
};

export const MARCA = "PayoutMetrics / JuegaEnLinea";

export const textoCelda = (c: Celda) => (typeof c === "string" ? c : c.texto);

async function logoDataUrl() {
  try {
    const blob = await (await fetch("/logo.png")).blob();
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const M = 14; // margen lateral (mm)

/** Dibuja el documento con jsPDF + autoTable (texto real) y lo descarga. */
export async function generarPdf(doc: DocumentoPdf) {
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: doc.orientacion === "horizontal" ? "landscape" : "portrait",
  });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const altoPie = 8 + doc.pie.length * 4;
  const limite = alto - altoPie - 4;
  const finalY = (def: number) =>
    (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? def;
  const normal = () => pdf.setFont("helvetica", "normal");
  const negrita = () => pdf.setFont("helvetica", "bold");
  const color = (t?: Tono) => (t ? pdf.setTextColor(...RGB_TONO[t]) : pdf.setTextColor(23));

  // 1. Cabecera
  const logo = await logoDataUrl();
  const x0 = logo ? 27 : M;
  if (logo) pdf.addImage(logo, "PNG", M, 10, 10, 10);
  negrita().setFontSize(14);
  color();
  pdf.text(doc.titulo, x0, 15);
  normal().setFontSize(9);
  color("suave");
  pdf.text(doc.subtitulo, x0, 20);
  pdf.text(MARCA, ancho - M, 15, { align: "right" });
  if (doc.estado) {
    negrita();
    color(doc.estado.tono ?? "suave");
    pdf.text(doc.estado.texto, ancho - M, 20, { align: "right" });
    normal();
  }
  pdf.setDrawColor(23).setLineWidth(0.5).line(M, 24, ancho - M, 24);

  let y = 28;
  const espacio = (necesario: number) => {
    if (y + necesario > limite) {
      pdf.addPage();
      y = 18;
    }
  };
  const titulo = (t: string) => {
    espacio(12);
    negrita().setFontSize(10);
    color();
    pdf.text(t, M, y + 4);
    normal();
    y += 6;
  };

  // 2. Bloques
  for (const b of doc.bloques) {
    if (b.tipo === "cajas") {
      const n = b.cajas.length;
      const conSub = b.cajas.some((c) => c.sub);
      const h = conSub ? 17 : 14;
      const anchoCaja = (ancho - 2 * M - 3 * (n - 1)) / n;
      espacio(h);
      b.cajas.forEach((c, i) => {
        const x = M + i * (anchoCaja + 3);
        pdf.setDrawColor(226).setLineWidth(0.2).roundedRect(x, y, anchoCaja, h, 1.5, 1.5);
        normal().setFontSize(7.5);
        color("suave");
        pdf.text(c.label, x + 2.5, y + 4.5);
        negrita().setFontSize(10.5);
        color(c.tono);
        pdf.text(pdf.splitTextToSize(c.valor, anchoCaja - 5)[0], x + 2.5, y + 10.5);
        if (c.sub) {
          normal().setFontSize(6.8);
          color("suave");
          pdf.text(pdf.splitTextToSize(c.sub, anchoCaja - 5)[0], x + 2.5, y + 14.5);
        }
      });
      normal();
      y += h + 5;
    } else if (b.tipo === "tabla") {
      if (b.titulo) titulo(b.titulo);
      const filas = b.filas.length
        ? b.filas
        : [[{ texto: b.vacio ?? "Sin datos.", tono: "suave" as Tono }]];
      autoTable(pdf, {
        startY: y,
        head: [b.cabecera],
        body: filas.map((f) => f.map(textoCelda)),
        styles: b.compacta
          ? { fontSize: 6.5, cellPadding: 0.9, textColor: 23, halign: "center", lineColor: 255, lineWidth: 0.3 }
          : { fontSize: 7.5, cellPadding: 1.6, textColor: 23 },
        headStyles: { fillColor: [242, 242, 242], textColor: 23, fontStyle: "bold" },
        ...(b.compacta ? { theme: "plain" as const } : {}),
        margin: { left: M, right: M, top: 18, bottom: altoPie + 4 },
        didParseCell: (d) => {
          if (d.section !== "body") return;
          if (!b.filas.length) {
            d.cell.colSpan = b.cabecera.length;
            d.cell.styles.textColor = RGB_TONO.suave;
            return;
          }
          const c = b.filas[d.row.index]?.[d.column.index];
          if (c && typeof c !== "string") {
            if (c.tono) d.cell.styles.textColor = RGB_TONO[c.tono];
            if (c.negrita) d.cell.styles.fontStyle = "bold";
            if (c.fondo) d.cell.styles.fillColor = RGB_FONDO[c.fondo];
          }
        },
      });
      y = finalY(y + 10) + 6;
    } else if (b.tipo === "notas") {
      titulo(b.titulo);
      pdf.setFontSize(8.5);
      if (b.items.length === 0) {
        color("suave");
        pdf.text(b.vacio, M, y + 3);
        y += 5;
      } else {
        for (const it of b.items) {
          const lineas: string[] = pdf.splitTextToSize(
            it.etiqueta ? `${it.etiqueta}: ${it.texto}` : it.texto,
            ancho - 2 * M,
          );
          espacio(lineas.length * 4);
          color();
          pdf.text(lineas, M, y + 3);
          y += lineas.length * 4 + 1.5;
        }
      }
      y += 4;
    } else {
      pdf.setFontSize(8.5);
      const lineas: string[] = pdf.splitTextToSize(b.texto, ancho - 2 * M);
      espacio(lineas.length * 4);
      if (b.negrita) negrita();
      color(b.tono);
      pdf.text(lineas, M, y + 3);
      normal();
      y += lineas.length * 4 + 1.5;
    }
  }

  // 3. Pie en todas las páginas
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    normal().setFontSize(7.5);
    color("suave");
    doc.pie.forEach((linea, j) =>
      pdf.text(linea, M, alto - 8 - (doc.pie.length - 1 - j) * 4),
    );
    pdf.text(`${i} / ${paginas}`, ancho - M, alto - 8, { align: "right" });
  }

  pdf.save(doc.nombreArchivo);
  return doc.nombreArchivo;
}
