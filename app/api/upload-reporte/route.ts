// src/app/api/upload-reporte/route.ts
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import {
  writeBatch,
  doc,
  collection,
  query,
  where,
  getDocs,
  limit,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface FilaReporteCruda {
  "Fecha de la operación": string;
  Jugador: number;
  Alias: string;
  Cantidad: number;
  Nivel: string;
  "Update date": string;
  "Log user": string;
  [key: string]: any;
}

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

  // Si viene vacío, asignamos "Autopago", si no, formateamos el nombre
  let operadorFormateado = "Autopago";
  if (logUserCrudo.trim() !== "") {
    operadorFormateado = logUserCrudo
      .split(".")
      .map(
        (nombre) =>
          nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase(),
      )
      .join(" ");
  }

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
    const currency = formData.get("currency") as string;

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

    const filasValidas = jsonDataCrudo.filter(
      (f) => f["Fecha de la operación"] && f["Update date"],
    );
    if (filasValidas.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "El archivo está vacío o no tiene el formato correcto.",
        },
        { status: 400 },
      );
    }

    // --- NUEVO: DETECCIÓN INTELIGENTE DE FECHA (Modo Dominante) ---
    const conteoFechas: Record<string, number> = {};
    let fechaMasFrecuente = "";
    let maxCount = 0;

    for (const fila of filasValidas) {
      // Extraemos solo la fecha ignorando la hora
      let fechaTexto = String(fila["Fecha de la operación"]).split(" ")[0];
      // Cambiamos slashes por guiones por si el Excel viene con formato 2026/03/01
      fechaTexto = fechaTexto.replace(/\//g, "-");

      conteoFechas[fechaTexto] = (conteoFechas[fechaTexto] || 0) + 1;
      if (conteoFechas[fechaTexto] > maxCount) {
        maxCount = conteoFechas[fechaTexto];
        fechaMasFrecuente = fechaTexto;
      }
    }

    // Identificamos el orden (YYYY-MM-DD vs DD-MM-YYYY) para no equivocarnos
    const partesFecha = fechaMasFrecuente.split("-");
    let year, month, day;

    if (partesFecha[0].length === 4) {
      year = partesFecha[0];
      month = partesFecha[1];
      day = partesFecha[2];
    } else {
      day = partesFecha[0];
      month = partesFecha[1];
      year = partesFecha[2];
    }

    // Generamos el string perfecto en UTC
    const dateStr = `${year}-${month}-${day}T00:00:00.000Z`;
    // --- FIN DETECCIÓN INTELIGENTE ---

    // 3. SISTEMA ANTI-DUPLICADOS
    const operacionesRef = collection(db, "operaciones_retiros");
    const q = query(
      operacionesRef,
      where("Moneda", "==", currency),
      where("Fecha del reporte", "==", dateStr),
      limit(1),
    );

    const duplicateCheck = await getDocs(q);
    if (!duplicateCheck.empty) {
      return NextResponse.json({
        success: false,
        code: "DUPLICATE",
        error: `El reporte del ${day}/${month}/${year} ya fue procesado en ${currency}.`,
      });
    }

    // 4. Transformar y guardar
    const datosListosParaFirebase = filasValidas.map((fila) =>
      transformarFila(fila, currency, dateStr),
    );

    const chunks = [];
    for (let i = 0; i < datosListosParaFirebase.length; i += 500) {
      chunks.push(datosListosParaFirebase.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((dato) => {
        const nuevoDocRef = doc(operacionesRef);
        batch.set(nuevoDocRef, dato);
      });
      await batch.commit();
    }

    // 5. Guardar en el Historial de Reportes
    const historialId = `${currency}_${year}-${month}-${day}`;
    const historialRef = doc(db, "historial_reportes", historialId);

    await setDoc(historialRef, {
      id: historialId,
      fechaReporte: dateStr,
      moneda: currency,
      totalRegistros: datosListosParaFirebase.length,
      subidoEl: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Reporte del ${day}/${month}/${year} guardado exitosamente.`,
      monedaGuardada: currency,
      totalRegistros: datosListosParaFirebase.length,
    });
  } catch (error) {
    console.error("Error procesando archivo:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
