// src/app/api/reportes/route.ts
import { NextResponse } from 'next/server';
import { getReportData } from '@/services/googleDrive';

export async function GET() {
  try {
    // Reemplaza esto con el ID real de tu archivo en la URL de Google Drive
    const FILE_ID = '1_twrJqbIEXudC_VKpXc82aSiR0xjfPs4QUBs7C0r1RY'; 
    
    // Llamamos a la función que creamos en el paso anterior
    const data = await getReportData(FILE_ID);
    
    // Devolvemos los datos al frontend en formato JSON
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: 'Hubo un error al leer el archivo de Drive' }, 
      { status: 500 }
    );
  }
}