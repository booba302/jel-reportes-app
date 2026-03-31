// src/app/gestor-reportes
// /page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Trash2,
  Eye,
  CalendarDays,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

// Importamos el AlertDialog de Shadcn
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  totalRegistros?: number;
  subidoEl: string;
  subidoPor?: string;
}

export default function GestorReportesPage() {
  const { currency } = useCurrency();
  const router = useRouter();
  const [reportes, setReportes] = React.useState<HistorialReporte[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  const [mesFiltro, setMesFiltro] = React.useState<string>(
    format(new Date(), "yyyy-MM"),
  );

  const fetchHistorial = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "historial_reportes"),
        where("moneda", "==", currency),
      );
      const snapshot = await getDocs(q);
      let data: HistorialReporte[] = [];
      snapshot.forEach((doc) => data.push(doc.data() as HistorialReporte));

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

  // Función limpia: Ya no usa window.confirm, se ejecuta directamente desde la alerta visual
  const handleEliminar = async (reporte: HistorialReporte) => {
    setIsDeleting(reporte.id);
    try {
      const url = `/api/delete-reporte?fecha=${reporte.fechaReporte}&moneda=${reporte.moneda}&id=${reporte.id}`;
      const response = await fetch(url, { method: "DELETE" });
      const json = await response.json();

      if (json.success) {
        toast.success("¡Eliminado!", { description: json.message });
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

  const handleVerDashboard = (fechaStr: string, monedaReporte: string) => {
    const params = new URLSearchParams();
    params.set("fecha", fechaStr);
    params.set("moneda", monedaReporte);
    router.push(`/auditoria-diaria?${params.toString()}`);
  };

  const reportesFiltrados = reportes.filter((r) => {
    if (!mesFiltro) return true;
    const mesReporte = r.fechaReporte.substring(0, 7);
    return mesReporte === mesFiltro;
  });

  const formatearFechaLocal = (fechaUtc: string) => {
    const [year, month, day] = fechaUtc.split("T")[0].split("-");
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    return format(localDate, "dd 'de' MMMM, yyyy", { locale: es });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Gestor de Archivos
          </h1>
          <p className="text-slate-500 mt-1">
            Administra los reportes cargados para{" "}
            <strong className="text-primary">{currency}</strong>
          </p>
        </div>

        {/* NOTA: Aquí también tienes un input type="month". Si quieres luego lo cambiamos por el popover de Shadcn que hicimos antes */}
        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <label className="text-sm font-medium text-slate-600">Mes:</label>
          <input
            type="month"
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="border-none bg-transparent text-sm font-medium focus:ring-0 outline-none text-slate-700"
          />
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-slate-700">
            <CalendarDays className="w-5 h-5 text-primary" /> Historial de
            Cargas
          </CardTitle>
          <CardDescription>
            Archivos Excel procesados en la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-6 font-semibold">
                  Fecha del Reporte
                </TableHead>
                <TableHead className="text-center font-semibold">
                  Total Retiros
                </TableHead>
                <TableHead className="font-semibold text-center">
                  Subido Por
                </TableHead>
                <TableHead className="font-semibold">Fecha de Subida</TableHead>
                <TableHead className="text-right pr-6 font-semibold">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : reportesFiltrados.length > 0 ? (
                reportesFiltrados.map((rep) => (
                  <TableRow
                    key={rep.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="pl-6 font-medium text-slate-800">
                      {formatearFechaLocal(rep.fechaReporte)}
                    </TableCell>
                    <TableCell className="text-center">
                      {rep.totalRegistros ? (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold">
                          {rep.totalRegistros}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          N/D
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-slate-600 text-sm font-medium">
                        <User className="w-4 h-4 mr-2 text-slate-400" />
                        {rep.subidoPor || "Sistema"}
                      </div>
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
                        className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200"
                      >
                        <Eye className="w-4 h-4 mr-1" /> Ver
                      </Button>

                      {/* NUEVO BOTÓN CON ALERT DIALOG */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
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
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Eliminar el reporte permanentemente?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-base text-slate-600">
                              Estás a punto de borrar el reporte del{" "}
                              <strong className="text-slate-800">
                                {formatearFechaLocal(rep.fechaReporte)}
                              </strong>{" "}
                              en{" "}
                              <strong className="text-slate-800">
                                {rep.moneda}
                              </strong>
                              .
                              <br />
                              <br />
                              Si lo eliminas, los retiros de este día ya no
                              aparecerán en la auditoría diaria.{" "}
                              <strong className="text-rose-600">
                                Esta acción no se puede deshacer.
                              </strong>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleEliminar(rep)}
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              Sí, eliminar reporte
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
