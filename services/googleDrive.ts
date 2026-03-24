// src/services/googleDrive.ts
import { google } from "googleapis";
import * as xlsx from "xlsx";

// 1. Configuramos la autenticación con la Cuenta de Servicio
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    // Reemplazamos los \\n literales por saltos de línea reales para evitar errores
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive.readonly"], // Solo permiso de lectura
});

const drive = google.drive({ version: "v3", auth });

// 2. Función para descargar y leer el archivo Excel
export async function getReportData(fileId: string) {
  try {
    // Descargamos el archivo desde Drive
    const response = await drive.files.export(
      {
        fileId: fileId,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      { responseType: "arraybuffer" },
    );

    // Parseamos el buffer con la librería xlsx
    const data = new Uint8Array(response.data as ArrayBuffer);
    const workbook = xlsx.read(data, { type: "array" });

    // Seleccionamos la primera hoja del Excel
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convertimos la hoja a un formato JSON (arreglo de objetos)
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    return jsonData;
  } catch (error) {
    console.error("Error obteniendo el archivo de Drive:", error);
    throw error;
  }
}
