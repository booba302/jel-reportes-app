// src/app/page.tsx
'use client'; // Le dice a Next.js que este componente usa interactividad en el navegador

import { useState } from 'react';

export default function Home() {
  const [datos, setDatos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  const probarConexion = async () => {
    setCargando(true);
    try {
      // Llamamos a la ruta de API que acabamos de crear
      const res = await fetch('/api/reportes');
      const json = await res.json();
      
      if (json.success) {
        setDatos(json.data); // Guardamos los datos del Excel en el estado
      } else {
        alert('Error: ' + json.error);
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="p-10 font-sans max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Prueba de Extracción de Reportes</h1>
      
      <button 
        onClick={probarConexion}
        disabled={cargando}
        className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 disabled:bg-gray-400 transition-colors mb-6"
      >
        {cargando ? 'Extrayendo...' : 'Traer datos desde Google Drive'}
      </button>
      
      {/* Aquí mostraremos el resultado crudo del Excel */}
      <div className="bg-slate-100 p-6 rounded-lg overflow-auto max-h-[600px] border border-slate-200">
        <pre className="text-sm">
          {datos.length > 0 
            ? JSON.stringify(datos, null, 2) 
            : 'Haz clic en el botón para cargar las métricas.'}
        </pre>
      </div>
    </div>
  );
}