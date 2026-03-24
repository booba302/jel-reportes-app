// src/app/reporte-diario/page.tsx
'use client'; // Necesario para hooks de React como useState

import * as React from 'react';
import { format } from 'date-fns';
import { useCurrency } from '../context/CurrencyContext';
import { es } from 'date-fns/locale'; // Idioma español
import { Calendar as CalendarIcon, UploadCloud, Loader2 } from 'lucide-react'; // Íconos

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner'; // Notificaciones bonitas

export default function ReporteDiarioPage() {
  // Estados para manejar los inputs y la carga
  const [date, setDate] = React.useState<Date>();
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [resultData, setResultData] = React.useState<any>(null);

  const { currency } = useCurrency();

  React.useEffect(() => {
    setDate(undefined);
    setFile(null);
    setResultData(null);
    
    // Opcional: Reiniciar el valor del input type="file" visualmente
    const fileInput = document.getElementById('excel-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
  }, [currency]); // El arreglo [currency] le dice a React: "Ejecuta esto solo si currency cambia"

  // Manejador del cambio de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Pequeña validación: solo aceptar .xlsx o .xls
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('Error', { description: 'Por favor sube solo archivos de Excel (.xlsx)' });
        return;
      }
      setFile(selectedFile);
    }
  };

  // Manejador del envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResultData(null); // Limpiar resultados anteriores

    if (!date || !file) {
      toast.error('Campos incompletos', { description: 'Por favor selecciona una fecha y sube un archivo.' });
      return;
    }

    setIsLoading(true);

    // Creamos un FormData para enviar el archivo binario y la fecha
    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date.toISOString());
    formData.append('currency', currency);

    try {
      // Llamaremos a una nueva ruta de API
      const response = await fetch('/api/upload-reporte', {
        method: 'POST',
        body: formData,
        // Nota: No seteamos Content-Type, fetch lo hace automáticamente para FormData
      });

      const json = await response.json();

      if (json.success) {
        toast.success('¡Éxito!', { description: 'Archivo procesado correctamente.' });
        setResultData(json.data); // Guardamos el JSON devuelto para mostrarlo
      } else {
        toast.error('Error', { description: json.error || 'Hubo un problema al procesar el archivo.' });
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de red', { description: 'No se pudo conectar con el servidor.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Crear Reporte Diario</CardTitle>
            <UploadCloud className="w-8 h-8 text-primary" />
          </div>
          <CardDescription>
            Selecciona la fecha del reporte y sube el archivo Excel con los datos.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            
            {/* Campo de Fecha */}
            <div className="space-y-2 flex flex-col">
              <Label htmlFor="date">Fecha del Reporte</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={es} // Calendario en español
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Campo de Archivo Excel */}
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="excel-file">Archivo Excel (.xlsx)</Label>
              <Input 
                id="excel-file" 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Archivo seleccionado: <span className="font-medium text-slate-700">{file.name}</span>
                </p>
              )}
            </div>

          </CardContent>
          
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Procesar Reporte'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Sección para mostrar la prueba de datos JSON (solo visible si hay datos) */}
      {resultData && (
        <Card className="w-full max-w-4xl mt-10 shadow-sm border-dashed border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg">Prueba: Datos extraídos del archivo subido</CardTitle>
            <CardDescription>
              A continuación se muestran las primeras filas detectadas en formato JSON crudo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-950 p-5 rounded-md overflow-auto max-h-96">
              <pre className="text-xs text-green-400 font-mono">
                {JSON.stringify(resultData, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}