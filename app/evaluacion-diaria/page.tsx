// src/app/evaluacion/page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
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
  Globe,
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
  operador: string;
  totalRetiros: number;
  cumplimientoSlaPct: number;
  tiempoPromedioMin: number;
  puntajeSla: number;
  puntajeTiempo: number;
  puntualidad: number | string;
  proactividad: number | string;
  completoTurno: boolean;
  tuvoInconveniente: boolean;
  comentarioInconveniente: string;
  estado: "Pendiente" | "Confirmado";
}

export default function EvaluacionDesempenoPage() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [evaluaciones, setEvaluaciones] = React.useState<Evaluacion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [modalOpenId, setModalOpenId] = React.useState<string | null>(null);

  // Generador de formato de fecha seguro para la BD (T00:00:00.000Z)
  const getSafeDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}T00:00:00.000Z`;
  };

  const fetchEvaluaciones = async () => {
    if (!date) return;
    setIsLoading(true);

    try {
      const dateStr = getSafeDateStr(date);
      const q = query(
        collection(db, "evaluaciones_desempeno"),
        where("fecha", "==", dateStr),
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
  }, [date]);

  // MOTOR DE SINCRONIZACIÓN GLOBAL (Reemplaza la API antigua)
  const handleSincronizar = async () => {
    if (!date) return;
    setIsSyncing(true);

    try {
      const dateDB = getSafeDateStr(date);
      const [year, month, day] = dateDB.split("T")[0].split("-");
      const dateOnly = `${year}-${month}-${day}`; // Para el ID único

      // 1. Buscamos TODAS las operaciones de TODAS las monedas para ese día
      const qOps = query(
        collection(db, "operaciones_retiros"),
        where("Fecha del reporte", "==", dateDB),
      );

      const snapshotOps = await getDocs(qOps);

      if (snapshotOps.empty) {
        toast.warning("Sin datos", {
          description:
            "No hay retiros procesados en ninguna moneda para este día.",
        });
        setIsSyncing(false);
        return;
      }

      // 2. Agrupamos por Operador
      const agtMap: Record<
        string,
        { total: number; slaCount: number; totalTime: number }
      > = {};

      snapshotOps.forEach((doc) => {
        const data = doc.data();
        const op = data.Operador;

        if (!op || op === "Autopago" || op === "Desconocido") return; // Excluimos bots y errores

        if (!agtMap[op]) agtMap[op] = { total: 0, slaCount: 0, totalTime: 0 };

        agtMap[op].total++;
        agtMap[op].totalTime += Number(data.Tiempo) || 0;
        if (data.Cumple === true) agtMap[op].slaCount++;
      });

      // 3. Calculamos, guardamos y actualizamos
      const promesas = Object.keys(agtMap).map(async (op) => {
        const metrics = agtMap[op];
        const idUnico = `${dateOnly}_${op.replace(/\s+/g, "")}`; // Ej: 2026-03-27_AngelAleman

        const slaPct = (metrics.slaCount / metrics.total) * 100;
        const avgTime = metrics.totalTime / metrics.total;

        // Fórmula de puntos (SLA: 1 punto por cada 10%, Tiempo: 10 pts si es <0, va restando si sube)
        const pSla = Number((slaPct / 10).toFixed(1));
        const pTiempo = Number(Math.max(0, 10 - avgTime / 3).toFixed(1)); // Penaliza tiempos altos

        const docRef = doc(db, "evaluaciones_desempeno", idUnico);
        const existingDoc = await getDoc(docRef);

        if (existingDoc.exists()) {
          // Si ya existe, SOLO actualizamos la matemática (respetando lo cualitativo que ya llenó el jefe)
          await updateDoc(docRef, {
            totalRetiros: metrics.total,
            cumplimientoSlaPct: Number(slaPct.toFixed(1)),
            tiempoPromedioMin: Number(avgTime.toFixed(1)),
            puntajeSla: pSla,
            puntajeTiempo: pTiempo,
          });
        } else {
          // Si es nuevo, lo creamos asumiendo calificación perfecta por defecto
          await setDoc(docRef, {
            id: idUnico,
            fecha: dateDB,
            operador: op,
            totalRetiros: metrics.total,
            cumplimientoSlaPct: Number(slaPct.toFixed(1)),
            tiempoPromedioMin: Number(avgTime.toFixed(1)),
            puntajeSla: pSla,
            puntajeTiempo: pTiempo,
            puntualidad: 10, // <-- CAMBIADO A 10
            proactividad: 10, // <-- CAMBIADO A 10
            completoTurno: true,
            tuvoInconveniente: false,
            comentarioInconveniente: "",
            estado: "Pendiente",
          });
        }
      });

      await Promise.all(promesas);

      toast.success("Día Sincronizado", {
        description: "Se unificaron los datos de todas las monedas.",
      });
      await fetchEvaluaciones();
    } catch (error) {
      console.error(error);
      toast.error("Error al sincronizar los datos de Firebase.");
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

  // NUEVA FUNCIÓN: Protege que los valores no superen el 10
  const handleActitudChange = (
    id: string,
    field: "puntualidad" | "proactividad",
    val: string,
  ) => {
    if (val === "") {
      handleUpdateLocal(id, field, ""); // Permite borrar para escribir otro número
      return;
    }
    let num = parseInt(val, 10);
    if (num > 10) num = 10; // El escudo protector
    handleUpdateLocal(id, field, num);
  };

  const calcularPuntajeFinal = (ev: Evaluacion) => {
    const pSla = (ev.puntajeSla || 0) * 0.3;
    const pTiempo = (ev.puntajeTiempo || 0) * 0.3;
    const pPunt = (Number(ev.puntualidad) || 0) * 0.2;
    const pProac = (Number(ev.proactividad) || 0) * 0.2;
    return pSla + pTiempo + pPunt + pProac;
  };

  const handleConfirmar = async (ev: Evaluacion) => {
    if (ev.puntualidad === "" || ev.proactividad === "") {
      return toast.warning("Campos incompletos", {
        description: "La puntualidad y proactividad no pueden estar vacías.",
      });
    }

    const punt = Number(ev.puntualidad);
    const proac = Number(ev.proactividad);

    if (punt < 0 || punt > 10 || proac < 0 || proac > 10) {
      return toast.warning("Puntajes inválidos", {
        description: "Los puntajes de actitud deben ser de 1 a 10.",
      });
    }

    try {
      const docRef = doc(db, "evaluaciones_desempeno", ev.id);
      await updateDoc(docRef, {
        puntualidad: punt,
        proactividad: proac,
        completoTurno: ev.completoTurno,
        tuvoInconveniente: ev.tuvoInconveniente,
        comentarioInconveniente: ev.comentarioInconveniente, // Ahora es 100% opcional
        puntajeFinal: calcularPuntajeFinal(ev),
        estado: "Confirmado",
        confirmadoEl: new Date().toISOString(),
      });

      toast.success("Evaluación Confirmada", {
        description: `Rendimiento de ${ev.operador} guardado.`,
      });
      handleUpdateLocal(ev.id, "estado", "Confirmado");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar la evaluación.");
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 relative animate-in fade-in duration-500">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            Evaluación de Desempeño
          </h1>
          <p className="text-slate-500 mt-1 flex items-center text-sm">
            <Globe className="w-4 h-4 mr-1 text-primary" /> Calificación diaria
            consolidada (Todas las monedas)
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
                required
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
            Sincronizar Día Global
          </Button>
        </div>
      </div>

      {/* Tabla de Auditoría */}
      <Card className="shadow-md border-primary/10">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            Auditoría de Equipo
          </CardTitle>
          <CardDescription>
            Si subiste un archivo nuevo o un operador no aparece, haz clic en{" "}
            <b>Sincronizar Día Global</b> para recalcular la matemática.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader className="bg-white">
              <TableRow>
                <TableHead className="font-semibold w-[200px] pl-6">
                  Operador
                </TableHead>
                <TableHead className="text-center w-[150px]">
                  Rendimiento Global
                </TableHead>
                <TableHead className="text-center w-[200px]">
                  Puntajes Automáticos
                </TableHead>
                <TableHead className="text-center w-[200px]">
                  Actitud (1 a 10)
                </TableHead>
                <TableHead className="text-center w-[200px]">
                  Control de Turno
                </TableHead>
                <TableHead className="text-center w-[120px]">
                  Nota Final
                </TableHead>
                <TableHead className="text-right w-[150px] pr-6">
                  Acción
                </TableHead>
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
                      className={
                        isConfirmado ? "bg-slate-50/50" : "hover:bg-slate-50/30"
                      }
                    >
                      <TableCell className="font-medium text-slate-800 pl-6">
                        {ev.operador}
                        <div className="text-xs text-slate-500 font-normal mt-1 flex items-center">
                          <Globe className="w-3 h-3 mr-1" /> {ev.totalRetiros}{" "}
                          retiros en total
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="text-sm">
                          <span className="text-emerald-600 font-medium">
                            SLA: {ev.cumplimientoSlaPct}%
                          </span>
                          <br />
                          <span className="text-amber-600 font-medium">
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
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex flex-col items-center">
                            <label className="text-[10px] text-slate-500 mb-1">
                              Puntualidad
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={ev.puntualidad}
                              onChange={(e) =>
                                handleActitudChange(
                                  ev.id,
                                  "puntualidad",
                                  e.target.value,
                                )
                              } // <-- ACTUALIZADO
                              disabled={isConfirmado}
                              className="w-14 text-center border rounded py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                          <div className="flex flex-col items-center">
                            <label className="text-[10px] text-slate-500 mb-1">
                              Proactividad
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={ev.proactividad}
                              onChange={(e) =>
                                handleActitudChange(
                                  ev.id,
                                  "proactividad",
                                  e.target.value,
                                )
                              } // <-- ACTUALIZADO
                              disabled={isConfirmado}
                              className="w-14 text-center border rounded py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-primary outline-none"
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
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
                              )}
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {ev.comentarioInconveniente
                                ? "Ver Observación"
                                : "+ Añadir Observación"}
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

                      <TableCell className="text-right pr-6">
                        {isConfirmado ? (
                          <div className="flex items-center justify-end text-emerald-600 font-medium text-sm">
                            <CheckCircle2 className="w-5 h-5 mr-1" /> Confirmado
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmar(ev)}
                            className="bg-slate-900 hover:bg-slate-800"
                          >
                            <Save className="w-4 h-4 mr-2" /> Guardar
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
                    Haz clic en <b>"Sincronizar Día Global"</b> para extraer los
                    datos de todas las monedas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Observaciones (Opcional) */}
      {modalOpenId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-amber-500" />{" "}
                Observaciones (Opcional)
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
                    Registra si <b>{ev.operador}</b> tuvo algún inconveniente
                    técnico, tardanza justificada o evento destacable.
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
                    className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Ej: Ausente durante 1 hora por corte eléctrico..."
                  />

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => setModalOpenId(null)}
                      className="bg-slate-900 text-white hover:bg-slate-800"
                    >
                      {ev.estado === "Confirmado" ? "Cerrar" : "Guardar Nota"}
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
