// src/app/api/sincronizar-evaluaciones/route.ts
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Fórmulas de Excel traducidas a JavaScript
const calcularPuntajeSLA = (porcentaje: number) => {
  if (porcentaje <= 100 && porcentaje > 90) return 10;
  if (porcentaje <= 90 && porcentaje > 80) return 9;
  if (porcentaje <= 80 && porcentaje > 70) return 8;
  if (porcentaje <= 70 && porcentaje > 60) return 7;
  if (porcentaje <= 60 && porcentaje > 50) return 6;
  if (porcentaje <= 50 && porcentaje > 40) return 5;
  if (porcentaje <= 40 && porcentaje > 30) return 4;
  if (porcentaje <= 30 && porcentaje > 20) return 3;
  if (porcentaje <= 20 && porcentaje > 10) return 2;
  if (porcentaje <= 10 && porcentaje > 0) return 1;
  return 0;
};

const calcularPuntajeTiempo = (minutos: number) => {
  if (minutos <= 15 && minutos > 0) return 10;
  if (minutos > 15 && minutos <= 25) return 9;
  if (minutos > 25 && minutos <= 30) return 8;
  if (minutos > 30 && minutos <= 35) return 7;
  if (minutos > 35 && minutos <= 40) return 6;
  if (minutos > 40 && minutos <= 45) return 5;
  if (minutos > 45 && minutos <= 50) return 4;
  if (minutos > 50 && minutos <= 55) return 3;
  if (minutos > 55 && minutos <= 60) return 2;
  if (minutos > 60) return 1;
  return 0;
};

export async function POST(request: Request) {
  try {
    const { fecha, moneda } = await request.json();

    if (!fecha || !moneda) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros' }, { status: 400 });
    }

    // 1. Buscamos todas las operaciones de ese día y moneda
    const q = query(
      collection(db, 'operaciones_retiros'),
      where('Fecha del reporte', '==', fecha),
      where('Moneda', '==', moneda)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ success: false, error: 'No hay retiros cargados para esta fecha y moneda.' }, { status: 404 });
    }

    // 2. Agrupamos por operador humano (ignorando Autopago y vacíos)
    const agrupado: Record<string, any> = {};

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const operador = data.Operador || "Autopago";

      if (operador === "Autopago") return; // Omitimos el sistema automático

      if (!agrupado[operador]) {
        agrupado[operador] = {
          total: 0,
          cumple: 0,
          noCumple: 0,
          tiempoTotal: 0
        };
      }
      agrupado[operador].total += 1;
      agrupado[operador].tiempoTotal += data.Tiempo;
      if (data.Cumple) agrupado[operador].cumple += 1;
      else agrupado[operador].noCumple += 1;
    });

    // 3. Calculamos puntajes y preparamos el guardado en bloque (Batch)
    const batch = writeBatch(db);
    const evaluacionesRef = collection(db, 'evaluaciones_diarias');
    let procesados = 0;

    for (const [nombre, stats] of Object.entries(agrupado)) {
      const porcentajeSla = (stats.cumple / stats.total) * 100;
      const promedioTiempo = stats.tiempoTotal / stats.total;

      const puntajeSla = calcularPuntajeSLA(porcentajeSla);
      const puntajeTiempo = calcularPuntajeTiempo(promedioTiempo);

      // ID Único para evitar duplicar la evaluación del mismo operador el mismo día
      const safeNombre = nombre.replace(/\s+/g, '_').toLowerCase();
      const evalId = `${moneda}_${fecha.split('T')[0]}_${safeNombre}`;
      const docRef = doc(evaluacionesRef, evalId);

      batch.set(docRef, {
        id: evalId,
        fecha,
        moneda,
        operador: nombre,
        totalRetiros: stats.total,
        dentroSla: stats.cumple,
        fueraSla: stats.noCumple,
        cumplimientoSlaPct: Number(porcentajeSla.toFixed(2)),
        tiempoPromedioMin: Number(promedioTiempo.toFixed(2)),
        puntajeSla,
        puntajeTiempo,
        
        // Campos Manuales por defecto (Fase 2)
        puntualidad: 10,
        proactividad: 10,
        completoTurno: true,
        tuvoInconveniente: false,
        comentarioInconveniente: "",
        
        estado: "Pendiente", // Cambiará a "Confirmado" cuando lo valides en la tabla
        ultimaActualizacion: new Date().toISOString()
      }, { merge: true }); // merge: true actualiza sin borrar lo manual si ya existía

      procesados++;
    }

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: `Sincronización completa. Se generaron borradores para ${procesados} operadores.` 
    });

  } catch (error) {
    console.error('Error sincronizando evaluaciones:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor.' }, { status: 500 });
  }
}