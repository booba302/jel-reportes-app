// src/app/api/upload-reporte/route.ts
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { writeBatch, doc, collection } from "firebase/firestore";
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

  // CREACIÓN DEL ID DETERMINISTA (Moneda + Jugador + Timestamp Exacto)
  // Ej: "2026-03-01 14:35:00" se convierte en "20260301143500"
  const timestampLimpio = String(fila["Fecha de la operación"]).replace(
    /[^0-9]/g,
    "",
  );
  const idUnico = `${moneda}_${fila["Jugador"]}_${timestampLimpio}`;

  return {
    idUnico, // Lo retornamos temporalmente para usarlo como llave en Firestore
    datos: {
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
    },
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const currency = formData.get("currency") as string;
    const subidoPor = formData.get('subidoPor') as string;

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

    // AGRUPACIÓN POR FECHAS
    const reportesAgrupados: Record<string, any[]> = {};

    for (const fila of filasValidas) {
      let fechaTexto = String(fila["Fecha de la operación"])
        .split(" ")[0]
        .replace(/\//g, "-");
      const partesFecha = fechaTexto.split("-");
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

      const paddedMonth = String(month).padStart(2, "0");
      const paddedDay = String(day).padStart(2, "0");
      const dateStr = `${year}-${paddedMonth}-${paddedDay}T00:00:00.000Z`;

      if (!reportesAgrupados[dateStr]) reportesAgrupados[dateStr] = [];
      reportesAgrupados[dateStr].push(fila);
    }

    const operacionesRef = collection(db, "operaciones_retiros");
    const todasLasOperacionesNuevas = [];
    const historialesNuevos = [];
    const fechasProcesadas = Object.keys(reportesAgrupados);

    // PREPARAMOS TODOS LOS DATOS
    for (const [dateStr, filasDeLaFecha] of Object.entries(reportesAgrupados)) {
      // Transformamos las filas y obtenemos su ID único
      const transformadas = filasDeLaFecha.map((fila) =>
        transformarFila(fila, currency, dateStr),
      );
      todasLasOperacionesNuevas.push(...transformadas);

      // Preparamos el historial para el Gestor
      const [year, month, day] = dateStr.split("T")[0].split("-");
      const historialId = `${currency}_${year}-${month}-${day}`;

      historialesNuevos.push({
        id: historialId,
        fechaReporte: dateStr,
        moneda: currency,
        subidoEl: new Date().toISOString(),
        subidoPor: subidoPor || 'Sistema'
      });
    }

    // GUARDADO MASIVO (BATCH) CON MERGE (Sobrescribe si existe, crea si no existe)
    // Procesamos en bloques de 500 porque es el límite de Firebase Batch
    const chunks = [];
    for (let i = 0; i < todasLasOperacionesNuevas.length; i += 500) {
      chunks.push(todasLasOperacionesNuevas.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        // Usamos el ID determinista específico en lugar de dejar que Firebase invente uno
        const docRef = doc(operacionesRef, item.idUnico);
        batch.set(docRef, item.datos, { merge: true });
      });
      await batch.commit();
    }

    // Guardar/Actualizar los historiales
    const batchHistorial = writeBatch(db);
    historialesNuevos.forEach((historial) => {
      const ref = doc(db, "historial_reportes", historial.id);
      // Solo actualizamos la fecha de subida para no sobreescribir otros datos si ya existía
      batchHistorial.set(ref, historial, { merge: true });
    });
    await batchHistorial.commit();

    return NextResponse.json({
      success: true,
      message: `Archivo procesado con éxito. Se escanearon ${todasLasOperacionesNuevas.length} registros distribuidos en ${fechasProcesadas.length} días.`,
      monedaGuardada: currency,
    });
  } catch (error) {
    console.error("Error procesando archivo:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
