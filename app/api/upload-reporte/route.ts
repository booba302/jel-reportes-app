// src/app/api/upload-reporte/route.ts
import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { writeBatch, doc, collection, query, where, getDocs, limit, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 

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

function transformarFila(fila: FilaReporteCruda, moneda: string, fechaReporte: string) {
  const fechaOperacion = new Date(fila["Fecha de la operación"]);
  const fechaUpdate = new Date(fila["Update date"]);

  const diferenciaMs = fechaUpdate.getTime() - fechaOperacion.getTime();
  const minutos = diferenciaMs / (1000 * 60);
  const tiempo = Number(minutos.toFixed(2));
  const cumple = tiempo < 30;

  const logUserCrudo = fila["Log user"] || ""; 
  const operadorFormateado = logUserCrudo
    .split('.')
    .map(nombre => nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase())
    .join(' ');

  return {
    "Fecha de la operación": fila["Fecha de la operación"],
    "Jugador": fila["Jugador"],
    "Alias": fila["Alias"],
    "Cantidad": fila["Cantidad"],
    "Nivel": fila["Nivel"],
    "Update date": fila["Update date"],
    "Tiempo": tiempo,
    "Cumple": cumple,
    "Moneda": moneda,
    "Fecha del reporte": fechaReporte,
    "Operador": operadorFormateado 
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const currency = formData.get('currency') as string; 
    // Ya no recibimos 'date' desde el frontend

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonDataCrudo = xlsx.utils.sheet_to_json<FilaReporteCruda>(worksheet, { defval: null });

    // 1. Validamos que el archivo tenga datos útiles
    const filasValidas = jsonDataCrudo.filter(f => f["Fecha de la operación"] && f["Update date"]);
    if (filasValidas.length === 0) {
      return NextResponse.json({ success: false, error: 'El archivo está vacío o no tiene el formato correcto.' }, { status: 400 });
    }

    // 2. DETECCIÓN AUTOMÁTICA DE FECHA
    // Tomamos la primera fila válida (ej: "2026-03-07 17:05:35") y extraemos solo la fecha ("2026-03-07")
    const fechaTexto = filasValidas[0]["Fecha de la operación"].split(' ')[0]; 
    const [year, month, day] = fechaTexto.split('-');
    
    // Reconstruimos la fecha a la medianoche para que coincida exactamente con la firma de búsqueda del Dashboard
    const fechaReporteObj = new Date(Number(year), Number(month) - 1, Number(day));
    const dateStr = fechaReporteObj.toISOString(); 

    // 3. SISTEMA ANTI-DUPLICADOS (Pre-vuelo a Firebase)
    const operacionesRef = collection(db, 'operaciones_retiros'); 
    const q = query(
      operacionesRef,
      where('Moneda', '==', currency),
      where('Fecha del reporte', '==', dateStr),
      limit(1) // Solo necesitamos encontrar 1 registro para saber que ya existe
    );
    
    const duplicateCheck = await getDocs(q);
    if (!duplicateCheck.empty) {
      // Si ya hay datos, detenemos el proceso e informamos al frontend
      return NextResponse.json({ 
        success: false, 
        code: 'DUPLICATE',
        error: `El reporte del ${day}/${month}/${year} ya fue procesado en ${currency}.` 
      });
    }

    // 4. Si no hay duplicados, transformamos y guardamos
    const datosListosParaFirebase = filasValidas.map(fila => transformarFila(fila, currency, dateStr));

    const chunks = [];
    for (let i = 0; i < datosListosParaFirebase.length; i += 500) {
      chunks.push(datosListosParaFirebase.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db); 
      chunk.forEach(dato => {
        const nuevoDocRef = doc(operacionesRef); 
        batch.set(nuevoDocRef, dato); 
      });
      await batch.commit(); 
    }

    const historialId = `${currency}_${fechaTexto}`; 
    const historialRef = doc(db, 'historial_reportes', historialId);
    
    await setDoc(historialRef, {
      id: historialId,
      fechaReporte: dateStr,
      moneda: currency,
      totalRegistros: datosListosParaFirebase.length,
      subidoEl: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      message: `Reporte del ${day}/${month}/${year} guardado exitosamente.`,
      monedaGuardada: currency,
      totalRegistros: datosListosParaFirebase.length
    });

  } catch (error) {
    console.error('Error procesando archivo:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor.' }, { status: 500 });
  }
}