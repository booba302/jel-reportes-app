import { NextResponse } from 'next/server';
import { errorResponse, requireUser } from "@/lib/authServer";
import { getReportData } from '@/services/googleDrive';

export async function GET(request: Request) {
  try {
    await requireUser(request);
  } catch (e) {
    return errorResponse(e);
  }
  try {
    const FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID;
    if (!FILE_ID) {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_DRIVE_FILE_ID no está configurado.' },
        { status: 500 }
      );
    }

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