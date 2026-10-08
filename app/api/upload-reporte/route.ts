import { NextResponse } from "next/server";
import { errorResponse, requireUser, type Sesion } from "@/lib/authServer";
import * as xlsx from "xlsx";
import { exigirMoneda } from "@/lib/monedasServer";
import { guardarReporte } from "@/lib/retirosRepo";
import { filaRetiro, type FilaHistorial, type FilaRetiro } from "@/lib/retirosFila";

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

  const limiteSLA = 25;
  const cumple = tiempo <= limiteSLA;

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
  let yo: Sesion;
  try {
    yo = await requireUser(request);
  } catch (e) {
    return errorResponse(e);
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const currency = formData.get("currency") as string;
    const subidoPor = yo.nombre;
    try {
      exigirMoneda(yo, currency);
    } catch (e) {
      return errorResponse(e);
    }
    // Opcional: si viene, solo se procesa ese día ("2026-10-03")
    const fechaEsperada = formData.get("fechaEsperada") as string | null;

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

    if (fechaEsperada) {
      const clave = `${fechaEsperada}T00:00:00.000Z`;
      if (!reportesAgrupados[clave]) {
        return NextResponse.json(
          {
            success: false,
            code: "DATE_MISMATCH",
            error: `El archivo no contiene retiros del ${fechaEsperada}.`,
          },
          { status: 400 },
        );
      }
      // Procesar solo esa fecha
      for (const k of Object.keys(reportesAgrupados))
        if (k !== clave) delete reportesAgrupados[k];
    }

    const filas: FilaRetiro[] = [];
    const historiales: FilaHistorial[] = [];
    const fechasProcesadas = Object.keys(reportesAgrupados);

    for (const [dateStr, filasDeLaFecha] of Object.entries(reportesAgrupados)) {
      const transformadas = filasDeLaFecha.map((fila) => transformarFila(fila, currency, dateStr));
      for (const t of transformadas) {
        const f = filaRetiro(t.idUnico, t.datos);
        if (f) filas.push(f);
      }
      const dia = dateStr.slice(0, 10);
      historiales.push({
        id: `${currency}_${dia}`,
        fecha_reporte: dia,
        moneda: currency,
        subido_el: new Date().toISOString(),
        subido_por: subidoPor || "Sistema",
        total_registros: transformadas.length,
      });
    }

    await guardarReporte(filas, historiales);

    return NextResponse.json({
      success: true,
      message: `Archivo procesado con éxito. Se escanearon ${filas.length} registros distribuidos en ${fechasProcesadas.length} días.`,
      monedaGuardada: currency,
      totalRegistros: filas.length,
    });
  } catch (error) {
    console.error("Error procesando archivo:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
