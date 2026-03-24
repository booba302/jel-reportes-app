// src/app/api/upload-reporte/route.ts
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
// 1. Importamos las herramientas de Firestore y nuestra conexión a la base de datos
import { writeBatch, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface FilaReporteCruda {
  "Fecha de la operación": string;
  Jugador: number;
  Alias: string;
  Cantidad: number;
  Nivel: string;
  "Update date": string;
  "Log user": string; // Nueva propiedad
  [key: string]: any;
}

// 2. Modificamos la función para recibir la moneda y la fecha del reporte
function transformarFila(
  fila: FilaReporteCruda,
  moneda: string,
  fechaReporte: string,
) {
  const fechaOperacion = new Date(fila["Fecha de la operación"]);
  const fechaUpdate = new Date(fila["Update date"]);

  const diferenciaMs = fechaUpdate.getTime() - fechaOperacion.getTime();
  const minutos = diferenciaMs / (1000 * 60);
  const tiempo = Number(minutos.toFixed(2));
  const cumple = tiempo < 30;

  const logUserCrudo = fila["Log user"] || "";
  const operadorFormateado = logUserCrudo
    .split(".")
    .map(
      (nombre) =>
        nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase(),
    )
    .join(" ");

  return {
    "Fecha de la operación": fila["Fecha de la operación"],
    Jugador: fila["Jugador"],
    Alias: fila["Alias"],
    Cantidad: fila["Cantidad"],
    Nivel: fila["Nivel"],
    "Update date": fila["Update date"],
    Tiempo: tiempo,
    Cumple: cumple,
    Moneda: moneda,
    "Fecha del reporte": fechaReporte,
    Operador: operadorFormateado,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const dateStr = formData.get("date") as string;
    const currency = formData.get("currency") as string; // Obtenemos la moneda del frontend

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se recibió ningún archivo." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonDataCrudo = xlsx.utils.sheet_to_json<FilaReporteCruda>(
      worksheet,
      { defval: null },
    );

    // 4. Transformamos los datos pasando la moneda y la fecha
    const datosListosParaFirebase = jsonDataCrudo
      .filter((fila) => fila["Fecha de la operación"] && fila["Update date"])
      .map((fila) => transformarFila(fila, currency, dateStr));

    // 5. PREPARACIÓN PARA FIREBASE (Escritura en Lotes)
    // Definimos el nombre de la colección en la base de datos
    const operacionesRef = collection(db, "operaciones_retiros");

    // Dividimos el arreglo en "chunks" (pedazos) de 500 registros para respetar el límite de Firestore
    const chunks = [];
    for (let i = 0; i < datosListosParaFirebase.length; i += 500) {
      chunks.push(datosListosParaFirebase.slice(i, i + 500));
    }

    // 6. Ejecutamos la subida a Firebase por cada bloque de 500
    for (const chunk of chunks) {
      const batch = writeBatch(db); // Iniciamos un nuevo lote

      chunk.forEach((dato) => {
        const nuevoDocRef = doc(operacionesRef); // Genera un ID único automático
        batch.set(nuevoDocRef, dato); // Prepara el documento
      });

      await batch.commit(); // Envía los 500 registros a la nube al mismo tiempo
    }

    // 7. Retornamos el éxito al frontend
    return NextResponse.json({
      success: true,
      message: "Reporte procesado y guardado exitosamente.",
      monedaGuardada: currency,
      totalRegistros: datosListosParaFirebase.length,
    });
  } catch (error) {
    console.error("Error procesando y guardando reporte:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno al procesar/guardar en Firebase.",
      },
      { status: 500 },
    );
  }
}
