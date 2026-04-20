// src/app/api/fetch-api-reporte/route.ts
import { NextResponse } from "next/server";

// 🔴 CONFIGURACIÓN DE ZONA HORARIA
const HORAS_DIFERENCIA = 3;

function ajustarFechaUTCaLocal(fechaString: string) {
  if (!fechaString) return "";
  const date = new Date(fechaString.replace(" ", "T") + "Z");
  date.setHours(date.getHours() - HORAS_DIFERENCIA);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

const MAPA_OPERADORES: Record<number | string, string> = {
  1000010: "rafael.benitez",
  1000035: "angel.aleman",
  1000031: "juan.salcedo",
  1000057: "shirley.perez",
  1000056: "angel.gomez",
  1000025: "gabriel.amariscua",
  1000055: "franklin.sanchez",
  1000096: "yaraime",
  1000133: "edgliana.torrealba",
  1000098: "maryelin",
  1000094: "zeze",
  1000097: "leydy",
  1000099: "l.cornivel",
  1000095: "nayleth",
  1000100: "evelyn",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const currency = formData.get("currency") as string;
    const subidoPor = formData.get("subidoPor") as string;
    const fecha = formData.get("fecha") as string;

    const mapeoCompanias: Record<string, string> = {
      CLP: "JLC",
      PEN: "JLP",
      MXN: "JLM",
      VES: "JLV",
      USD: "JLV",
    };

    const company = mapeoCompanias[currency];
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Moneda no soportada" },
        { status: 400 },
      );
    }

    const token = process.env.CALIMACO_TOKEN;

    const fechaObj = new Date(`${fecha}T00:00:00Z`);
    const nextDayObj = new Date(fechaObj);
    nextDayObj.setUTCDate(nextDayObj.getUTCDate() + 1);
    const nextDayStr = nextDayObj.toISOString().split("T")[0];

    const startQuery = `${fecha} 0${HORAS_DIFERENCIA}:00:00`;
    const endQuery = `${nextDayStr} 0${HORAS_DIFERENCIA - 1}:59:59`;

    const bodyCalimaco = {
      company: company,
      report: "payouts_cashflow",
      filter: [
        {
          field: "t.operation_date",
          type: "time_range",
          value: [startQuery, endQuery],
        },
        {
          field: "t.status",
          value: "in PROCESSED",
          typeValue: "String",
          type: "SelectMultiple",
          useLikeFilter: true,
        },
      ],
      limit: "limit 0,100000",
    };

    const response = await fetch(
      "https://api-calimaco.jelintegration.link/api/getReportPrivate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyCalimaco),
      },
    );

    if (!response.ok) {
      throw new Error(`Error del API externa: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        {
          success: false,
          error: "Formato de respuesta inválido del proveedor.",
        },
        { status: 500 },
      );
    }

    const fechaReporte = `${fecha}T00:00:00.000Z`;
    const todasLasOperacionesNuevas = [];

    for (const item of data) {
      if (item.currency !== currency) continue;
      if (!item.operation_date || !item.updated_date) continue;

      const operationDateLocal = ajustarFechaUTCaLocal(item.operation_date);
      const processedDateLocal = ajustarFechaUTCaLocal(item.updated_date);

      if (!operationDateLocal.startsWith(fecha)) continue;

      const fechaOperacion = new Date(operationDateLocal.replace(" ", "T"));
      const fechaUpdate = new Date(processedDateLocal.replace(" ", "T"));

      const diferenciaMs = fechaUpdate.getTime() - fechaOperacion.getTime();
      const minutos = diferenciaMs / (1000 * 60);
      const tiempo = Number(minutos.toFixed(2));

      const limiteSLA = 25;
      const cumple = tiempo <= limiteSLA;

      const logUserId = item.log_user;
      let logUserCrudo = "Autopago";

      if (logUserId) {
        logUserCrudo = MAPA_OPERADORES[logUserId] || String(logUserId);
      }

      let operadorFormateado = "Autopago";
      if (logUserCrudo !== "Autopago") {
        operadorFormateado = logUserCrudo
          .split(".")
          .map(
            (nombre: string) =>
              nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase(),
          )
          .join(" ");
      }

      const timestampLimpio = operationDateLocal.replace(/[^0-9]/g, "");
      const idUnico = `${currency}_${item.user}_${timestampLimpio}`;

      todasLasOperacionesNuevas.push({
        idUnico,
        datos: {
          "Fecha de la operación": operationDateLocal,
          Jugador: item.user,
          Alias: item.alias || "",
          Cantidad: item.amount || 0,
          Nivel: item.level || "",
          "Update date": processedDateLocal,
          Tiempo: tiempo,
          Cumple: cumple,
          Moneda: currency,
          "Fecha del reporte": fechaReporte,
          Operador: operadorFormateado,
        },
      });
    }

    if (todasLasOperacionesNuevas.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No se encontraron operaciones para ${currency} en esta fecha.`,
        operaciones: [], // 🔴 Devolvemos array vacío
      });
    }

    const [year, month, day] = fecha.split("-");
    const historialId = `${currency}_${year}-${month}-${day}`;

    const historialData = {
      id: historialId,
      fechaReporte: fechaReporte,
      moneda: currency,
      subidoEl: new Date().toISOString(),
      subidoPor: subidoPor || "Extracción API",
      totalRegistros: todasLasOperacionesNuevas.length,
    };

    // 🔴 EN LUGAR DE GUARDAR, DEVOLVEMOS LA DATA AL FRONTEND
    return NextResponse.json({
      success: true,
      message: `Extracción completada. Listo para guardar ${todasLasOperacionesNuevas.length} operaciones.`,
      monedaGuardada: currency,
      operaciones: todasLasOperacionesNuevas,
      historial: historialData,
    });
  } catch (error) {
    console.error("Error en proxy de reportes:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al procesar el reporte." },
      { status: 500 },
    );
  }
}
