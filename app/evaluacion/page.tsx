// src/app/evaluacion/page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCurrency } from "../context/CurrencyContext";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import {
  Calendar as CalendarIcon,
  Loader2,
  RefreshCw,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { toast } from "sonner";

interface Evaluacion {
  id: string;
  fecha: string;
  moneda: string;
  operador: string;
  totalRetiros: number;
  cumplimientoSlaPct: number;
  tiempoPromedioMin: number;
  puntajeSla: number;
  puntajeTiempo: number;
  puntualidad: number | string; // Permitimos string para detectar cuando el input está vacío ("")
  proactividad: number | string;
  completoTurno: boolean;
  tuvoInconveniente: boolean;
  comentarioInconveniente: string;
  estado: "Pendiente" | "Confirmado";
}

export default function EvaluacionDiariaPage() {
  const { currency } = useCurrency();
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  const [evaluaciones, setEvaluaciones] = React.useState<Evaluacion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const [modalOpenId, setModalOpenId] = React.useState<string | null>(null);

  const fetchEvaluaciones = async () => {
    if (!date) return;
    setIsLoading(true);

    try {
      const dateStr = date.toISOString();
      const q = query(
        collection(db, "evaluaciones_diarias"),
        where("fecha", "==", dateStr),
        where("moneda", "==", currency),
      );

      const snapshot = await getDocs(q);
      const data: Evaluacion[] = [];
      snapshot.forEach((doc) => data.push(doc.data() as Evaluacion));

      data.sort((a, b) => a.operador.localeCompare(b.operador));
      setEvaluaciones(data);
    } catch (error) {
      console.error("Error cargando evaluaciones:", error);
      toast.error("Error al cargar la información.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEvaluaciones();
  }, [date, currency]);

  const handleSincronizar = async () => {
    if (!date) return;
    setIsSyncing(true);

    try {
      const response = await fetch("/api/sincronizar-evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: date.toISOString(), moneda: currency }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Día Sincronizado", { description: result.message });
        await fetchEvaluaciones();
      } else {
        toast.error("Error de Sincronización", { description: result.error });
      }
    } catch (error) {
      toast.error("Error de red al intentar sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateLocal = (
    id: string,
    field: keyof Evaluacion,
    value: any,
  ) => {
    setEvaluaciones((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, [field]: value } : ev)),
    );
  };

  const calcularPuntajeFinal = (ev: Evaluacion) => {
    const pSla = (ev.puntajeSla || 0) * 0.3;
    const pTiempo = (ev.puntajeTiempo || 0) * 0.3;
    const pPunt = (Number(ev.puntualidad) || 0) * 0.2;
    const pProac = (Number(ev.proactividad) || 0) * 0.2;
    return pSla + pTiempo + pPunt + pProac;
  };

  const handleConfirmar = async (ev: Evaluacion) => {
    // 1. Validación de campos vacíos
    if (ev.puntualidad === "" || ev.proactividad === "") {
      return toast.warning("Campos incompletos", {
        description: "La puntualidad y proactividad no pueden estar vacías.",
      });
    }

    // 2. Validación de rangos numéricos
    const punt = Number(ev.puntualidad);
    const proac = Number(ev.proactividad);

    if (punt < 0 || punt > 10 || proac < 0 || proac > 10) {
      return toast.warning("Puntajes inválidos", {
        description: "Los puntajes deben estar entre 0 y 10.",
      });
    }

    // 3. Validación del comentario
    if (ev.tuvoInconveniente && !ev.comentarioInconveniente.trim()) {
      return toast.warning("Falta comentario", {
        description: "Debes describir el inconveniente para continuar.",
      });
    }

    try {
      const docRef = doc(db, "evaluaciones_diarias", ev.id);
      await updateDoc(docRef, {
        puntualidad: punt,
        proactividad: proac,
        completoTurno: ev.completoTurno,
        tuvoInconveniente: ev.tuvoInconveniente,
        comentarioInconveniente: ev.comentarioInconveniente,
        puntajeFinal: calcularPuntajeFinal(ev),
        estado: "Confirmado",
        confirmadoEl: new Date().toISOString(),
      });

      toast.success("Evaluación Confirmada", {
        description: `El rendimiento de ${ev.operador} ha sido guardado.`,
      });
      handleUpdateLocal(ev.id, "estado", "Confirmado");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar la evaluación.");
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Evaluación de Desempeño
          </h1>
          <p className="text-slate-500 mt-1">
            Calificación diaria y auditoría en {currency}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[220px] justify-start text-left font-normal bg-white",
                  !date && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? (
                  format(date, "PPP", { locale: es })
                ) : (
                  <span>Selecciona fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>

          <Button
            onClick={handleSincronizar}
            disabled={isSyncing || !date}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar Día
          </Button>
        </div>
      </div>

      <Card className="shadow-md border-primary/10">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            Auditoría de Operadores
          </CardTitle>
          <CardDescription>
            Si un operador no aparece, asegúrate de haber sincronizado el día
            primero.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold w-[200px]">
                  Operador
                </TableHead>
                <TableHead className="text-center w-[150px]">
                  Rendimiento (Auto)
                </TableHead>
                <TableHead className="text-center w-[200px]">
                  Puntajes Automáticos
                </TableHead>
                <TableHead className="text-center w-[200px]">
                  Cualitativo (Manual)
                </TableHead>
                <TableHead className="text-center w-[200px]">
                  Asistencia / Turno
                </TableHead>
                <TableHead className="text-center w-[120px]">
                  Nota Final
                </TableHead>
                <TableHead className="text-right w-[150px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : evaluaciones.length > 0 ? (
                evaluaciones.map((ev) => {
                  const nota = calcularPuntajeFinal(ev);
                  const isConfirmado = ev.estado === "Confirmado";

                  return (
                    <TableRow
                      key={ev.id}
                      className={isConfirmado ? "bg-slate-50/50" : ""}
                    >
                      <TableCell className="font-medium text-slate-800">
                        {ev.operador}
                        <div className="text-xs text-slate-500 font-normal mt-1">
                          {ev.totalRetiros} retiros procesados
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="text-sm">
                          <span className="text-emerald-600 font-medium">
                            SLA: {ev.cumplimientoSlaPct}%
                          </span>
                          <br />
                          <span className="text-blue-600 font-medium">
                            TMP: {ev.tiempoPromedioMin}m
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center bg-slate-50/50 border-x">
                        <div className="text-sm font-semibold text-slate-700">
                          SLA: {ev.puntajeSla}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            /10
                          </span>
                          <br />
                          TMP: {ev.puntajeTiempo}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            /10
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                          Vale 60%
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex flex-col items-center">
                            <label className="text-[10px] text-slate-500 mb-1">
                              Puntualidad
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={ev.puntualidad}
                              onChange={(e) =>
                                handleUpdateLocal(
                                  ev.id,
                                  "puntualidad",
                                  e.target.value,
                                )
                              }
                              disabled={isConfirmado}
                              className="w-16 text-center border rounded-md py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                          <div className="flex flex-col items-center">
                            <label className="text-[10px] text-slate-500 mb-1">
                              Proactividad
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={ev.proactividad}
                              onChange={(e) =>
                                handleUpdateLocal(
                                  ev.id,
                                  "proactividad",
                                  e.target.value,
                                )
                              }
                              disabled={isConfirmado}
                              className="w-16 text-center border rounded-md py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                          Vale 40%
                        </div>
                      </TableCell>

                      <TableCell className="text-center border-x">
                        <div className="flex flex-col gap-2 items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 w-24 text-right">
                              Turno Completo
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                disabled={isConfirmado}
                                checked={ev.completoTurno}
                                onChange={(e) =>
                                  handleUpdateLocal(
                                    ev.id,
                                    "completoTurno",
                                    e.target.checked,
                                  )
                                }
                              />
                              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 w-24 text-right">
                              Inconveniente
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                disabled={isConfirmado}
                                checked={ev.tuvoInconveniente}
                                onChange={(e) =>
                                  handleUpdateLocal(
                                    ev.id,
                                    "tuvoInconveniente",
                                    e.target.checked,
                                  )
                                }
                              />
                              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                          </div>

                          {ev.tuvoInconveniente && (
                            <button
                              onClick={() => setModalOpenId(ev.id)}
                              className={cn(
                                "text-[10px] flex items-center px-2 py-1 rounded border transition-colors mt-1",
                                ev.comentarioInconveniente
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-600 border-rose-200 animate-pulse",
                              )}
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {ev.comentarioInconveniente
                                ? "Ver Comentario"
                                : "Falta Comentario!"}
                            </button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center bg-slate-50/50">
                        <div
                          className={cn(
                            "text-2xl font-bold",
                            nota >= 8
                              ? "text-emerald-600"
                              : nota >= 6
                                ? "text-amber-500"
                                : "text-rose-600",
                          )}
                        >
                          {nota.toFixed(1)}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        {isConfirmado ? (
                          <div className="flex items-center justify-end text-emerald-600 font-medium text-sm">
                            <CheckCircle2 className="w-5 h-5 mr-1" />
                            Listo
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmar(ev)}
                            className="bg-slate-900 hover:bg-slate-800"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Confirmar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 text-center text-slate-500"
                  >
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Aún no hay evaluaciones generadas para este día.
                    <br />
                    Haz clic en <b>"Sincronizar Día"</b> para empezar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {modalOpenId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-amber-500" />
                Detalles del Inconveniente
              </h3>
              <button
                onClick={() => setModalOpenId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {evaluaciones
              .filter((e) => e.id === modalOpenId)
              .map((ev) => (
                <div key={ev.id} className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Registra el motivo por el cual <b>{ev.operador}</b> tuvo un
                    inconveniente durante este turno. Este comentario aparecerá
                    en el reporte mensual.
                  </p>

                  <textarea
                    value={ev.comentarioInconveniente}
                    onChange={(e) =>
                      handleUpdateLocal(
                        ev.id,
                        "comentarioInconveniente",
                        e.target.value,
                      )
                    }
                    disabled={ev.estado === "Confirmado"}
                    className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Ej: Problemas con la conexión a internet durante 2 horas..."
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setModalOpenId(null)}
                    >
                      {ev.estado === "Confirmado"
                        ? "Cerrar"
                        : "Guardar temporalmente"}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
