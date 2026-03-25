// src/app/gestor/page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, Eye, CalendarDays, Loader2, AlertCircle } from "lucide-react";
import { useCurrency } from "../context/CurrencyContext"; // Ruta relativa
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface HistorialReporte {
  id: string;
  fechaReporte: string;
  moneda: string;
  totalRegistros: number;
  subidoEl: string;
}

export default function GestorReportesPage() {
  const { currency } = useCurrency();
  const router = useRouter();
  const [reportes, setReportes] = React.useState<HistorialReporte[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // Filtro de mes (Formato YYYY-MM)
  const [mesFiltro, setMesFiltro] = React.useState<string>(
    format(new Date(), "yyyy-MM"),
  );

  const fetchHistorial = async () => {
    setIsLoading(true);
    try {
      // Pedimos los reportes de la moneda seleccionada en la barra global
      const q = query(
        collection(db, "historial_reportes"),
        where("moneda", "==", currency),
      );

      const snapshot = await getDocs(q);
      let data: HistorialReporte[] = [];
      snapshot.forEach((doc) => data.push(doc.data() as HistorialReporte));

      // Ordenar del más reciente al más antiguo
      data.sort(
        (a, b) =>
          new Date(b.fechaReporte).getTime() -
          new Date(a.fechaReporte).getTime(),
      );
      setReportes(data);
    } catch (error) {
      console.error("Error obteniendo historial:", error);
      toast.error("Error al cargar el historial de reportes.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchHistorial();
  }, [currency]);

  const handleEliminar = async (reporte: HistorialReporte) => {
    const fechaLegible = format(new Date(reporte.fechaReporte), "dd/MM/yyyy");
    const confirmacion = window.confirm(
      `¿Estás absolutamente seguro de eliminar el reporte del ${fechaLegible} en ${reporte.moneda}?\n\nEsta acción borrará irreversiblemente sus ${reporte.totalRegistros} retiros de la base de datos.`,
    );

    if (!confirmacion) return;

    setIsDeleting(reporte.id);
    try {
      const url = `/api/delete-reporte?fecha=${reporte.fechaReporte}&moneda=${reporte.moneda}&id=${reporte.id}`;
      const response = await fetch(url, { method: "DELETE" });
      const json = await response.json();

      if (json.success) {
        toast.success("¡Eliminado!", { description: json.message });
        // Lo quitamos de la vista inmediatamente sin tener que recargar
        setReportes((prev) => prev.filter((r) => r.id !== reporte.id));
      } else {
        toast.error("Error al eliminar", { description: json.error });
      }
    } catch (error) {
      toast.error("Error de red al intentar eliminar el reporte.");
    } finally {
      setIsDeleting(null);
    }
  };

  // --- FUNCIÓN CORREGIDA ---
  const handleVerDashboard = (fechaStr: string, monedaReporte: string) => {
    const params = new URLSearchParams();
    params.set("fecha", fechaStr);
    params.set("moneda", monedaReporte);

    // Navegación limpia de Next.js manteniendo los parámetros
    router.push(`/dashboard?${params.toString()}`);
  };

  // Filtrado local por mes
  const reportesFiltrados = reportes.filter((r) => {
    if (!mesFiltro) return true;
    const fecha = new Date(r.fechaReporte);
    const mesReporte = format(fecha, "yyyy-MM");
    return mesReporte === mesFiltro;
  });

  const formatearFechaLocal = (fechaUtc: string) => {
    const [year, month, day] = fechaUtc.split("T")[0].split("-");
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    return format(localDate, "dd 'de' MMMM, yyyy", { locale: es });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Gestor de Archivos
          </h1>
          <p className="text-slate-500">
            Administra los reportes cargados para la moneda {currency}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">
            Filtrar por Mes:
          </label>
          <input
            type="month"
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Historial de Cargas
          </CardTitle>
          <CardDescription>
            Lista de los archivos Excel que han sido procesados y almacenados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="pl-6">Fecha del Reporte</TableHead>
                <TableHead className="text-center">Total Operaciones</TableHead>
                <TableHead>Fecha de Subida</TableHead>
                <TableHead className="text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : reportesFiltrados.length > 0 ? (
                reportesFiltrados.map((rep) => (
                  <TableRow key={rep.id}>
                    <TableCell className="pl-6 font-semibold text-slate-800">
                      {formatearFechaLocal(rep.fechaReporte)}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {rep.totalRegistros}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {format(new Date(rep.subidoEl), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right pr-6 space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleVerDashboard(rep.fechaReporte, rep.moneda)
                        }
                        className="text-slate-600 hover:text-blue-600"
                      >
                        <Eye className="w-4 h-4 mr-1" /> Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEliminar(rep)}
                        disabled={isDeleting === rep.id}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                      >
                        {isDeleting === rep.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-1" /> Borrar
                          </>
                        )}
                      </Button>
                      <TableCell className="pl-6 font-semibold text-slate-800">
                        {formatearFechaLocal(rep.fechaReporte)}
                      </TableCell>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-slate-500"
                  >
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No hay reportes cargados en {currency} para el mes
                    seleccionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
