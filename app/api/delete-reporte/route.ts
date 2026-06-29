import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    const moneda = searchParams.get('moneda');
    const idHistorial = searchParams.get('id');

    if (!fecha || !moneda || !idHistorial) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros' }, { status: 400 });
    }

    // 1. Buscar todos los registros individuales de esa fecha y moneda
    const q = adminDb.collection('operaciones_retiros')
      .where('Fecha del reporte', '==', fecha)
      .where('Moneda', '==', moneda);
    const snapshot = await q.get();

    // 2. Preparar el borrado en lotes (Batch) de 500 en 500
    const batches = [];
    let currentBatch = adminDb.batch();
    let count = 0;

    snapshot.docs.forEach((documento) => {
      currentBatch.delete(documento.ref);
      count++;
      if (count === 500) {
        batches.push(currentBatch.commit());
        currentBatch = adminDb.batch();
        count = 0;
      }
    });
    
    // Si quedaron registros en el último lote, lo enviamos
    if (count > 0) {
      batches.push(currentBatch.commit());
    }

    // Esperamos a que todos los retiros se borren de la base de datos
    await Promise.all(batches);

    // 3. Borramos el registro padre del historial
    await adminDb.collection('historial_reportes').doc(idHistorial).delete();

    return NextResponse.json({ 
      success: true, 
      message: `Reporte eliminado. Se borraron ${snapshot.docs.length} registros.` 
    });

  } catch (error) {
    console.error('Error eliminando reporte:', error);
    return NextResponse.json({ success: false, error: 'Error interno al eliminar.' }, { status: 500 });
  }
}