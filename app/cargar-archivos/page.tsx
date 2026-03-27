// src/app/reporte-diario/page.tsx
'use client';

import * as React from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Trash2, Play } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Definimos los estados posibles para cada archivo en la cola
type FileStatus = 'idle' | 'uploading' | 'success' | 'duplicate' | 'error';

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  message?: string;
}

export default function CargarArchivosPage() {
  const { currency } = useCurrency();
  const { userData } = useAuth();
  const [archivos, setArchivos] = React.useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Limpiamos la cola si el usuario cambia de moneda por seguridad
  React.useEffect(() => {
    setArchivos([]);
  }, [currency]);

  // Manejador para agregar múltiples archivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    
    if (selectedFiles.length !== validFiles.length) {
      toast.warning('Archivos ignorados', { description: 'Solo se permiten archivos Excel (.xlsx, .xls)' });
    }

    const newQueued = validFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'idle' as FileStatus
    }));

    setArchivos(prev => [...prev, ...newQueued]);
    
    // Reseteamos el input visualmente
    e.target.value = '';
  };

  const removeFile = (idToRemove: string) => {
    setArchivos(prev => prev.filter(f => f.id !== idToRemove));
  };

  // Motor de procesamiento secuencial
  const procesarTodos = async () => {
    const pendientes = archivos.filter(a => a.status === 'idle' || a.status === 'error');
    if (pendientes.length === 0) return toast.info('No hay archivos pendientes por procesar.');

    setIsProcessing(true);

    for (const item of pendientes) {
      // Marcamos el archivo actual como 'subiendo'
      setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, status: 'uploading' } : a));

      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('currency', currency);
      formData.append('subidoPor', userData?.nombre || 'Usuario Desconocido');

      try {
        const response = await fetch('/api/upload-reporte', {
          method: 'POST',
          body: formData,
        });

        const json = await response.json();

        if (json.success) {
          setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, status: 'success', message: json.message } : a));
        } else {
          // Si el backend detectó que ya existe, lo marcamos como duplicado
          const finalStatus = json.code === 'DUPLICATE' ? 'duplicate' : 'error';
          setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, status: finalStatus, message: json.error } : a));
        }
      } catch (error) {
        setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, status: 'error', message: 'Error de red' } : a));
      }
    }

    setIsProcessing(false);
    toast.success('Cola finalizada', { description: 'Revisa el estado individual de los archivos.' });
  };

  // Funciones de ayuda visual
  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case 'idle': return <FileSpreadsheet className="w-5 h-5 text-slate-400" />;
      case 'uploading': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'duplicate': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
    }
  };

  const getStatusBadge = (item: QueuedFile) => {
    switch (item.status) {
      case 'idle': return <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">Pendiente</span>;
      case 'uploading': return <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">Procesando...</span>;
      case 'success': return <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded">Completado</span>;
      case 'duplicate': return <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">Duplicado</span>;
      case 'error': return <span className="text-xs font-medium text-rose-700 bg-rose-100 px-2 py-1 rounded">Fallo</span>;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <Card className="w-full max-w-2xl shadow-lg border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Carga de Reportes ({currency})</CardTitle>
              <CardDescription className="mt-2">
                Sube múltiples archivos Excel. El sistema detectará automáticamente la fecha de cada uno y evitará subir duplicados.
              </CardDescription>
            </div>
            <div className="bg-primary/10 p-3 rounded-full">
              <UploadCloud className="w-8 h-8 text-primary" />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          
          {/* Zona de Selección de Archivos */}
          <div className="flex items-center justify-center w-full">
            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-slate-50 border-slate-300 hover:bg-slate-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 mb-3 text-slate-400" />
                <p className="mb-2 text-sm text-slate-600"><span className="font-semibold">Haz clic para buscar</span> o arrastra tus archivos aquí</p>
                <p className="text-xs text-slate-500">Solo archivos .xlsx o .xls</p>
              </div>
              <Input 
                id="dropzone-file" 
                type="file" 
                className="hidden" 
                multiple 
                accept=".xlsx, .xls"
                onChange={handleFileSelect}
                disabled={isProcessing}
              />
            </label>
          </div>

          {/* Lista de Archivos en Cola */}
          {archivos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Archivos en cola ({archivos.length})</h3>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {archivos.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {getStatusIcon(item.status)}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-[300px]">
                          {item.file.name}
                        </span>
                        {item.message && (
                          <span className={`text-xs ${item.status === 'duplicate' ? 'text-amber-600' : 'text-slate-500'}`}>
                            {item.message}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {getStatusBadge(item)}
                      
                      {/* Solo permite eliminar si no se está procesando en este instante */}
                      {item.status !== 'uploading' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeFile(item.id)}
                          disabled={isProcessing}
                          className="h-8 w-8 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </CardContent>
        
        <CardFooter className="bg-slate-50 border-t p-6">
          <Button 
            onClick={procesarTodos} 
            className="w-full text-base h-12" 
            disabled={isProcessing || archivos.length === 0}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Procesando en lote...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Procesar {archivos.filter(a => a.status === 'idle' || a.status === 'error').length} Archivos
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}