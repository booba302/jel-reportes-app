// src/app/(dashboard)/evaluacion-diaria/page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";

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
  grupoMoneda?: string;
}

export default function EvaluacionDesempenoPage() {
  const { userData } = useAuth();
  const userRole = userData?.rol?.toLowerCase() || "";
  const isAdmin =
    userRole.includes("admin") || userData?.rol === "Administrador";

  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [evaluaciones, setEvaluaciones] = React.useState<Evaluacion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [modalOpenId, setModalOpenId] = React.useState<string | null>(null);

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

      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as Evaluacion;

        // FILTRADO POR ROL
        if (!isAdmin) {
          if (
            userRole === "agente_retiro_inter" &&
            item.grupoMoneda === "nacional"
          )
            return;
          if (
            userRole === "agente_retiros_nacional" &&
            item.grupoMoneda === "inter"
          )
            return;
        }

        data.push(item);
      });

      data.sort((a, b) => a.operador.localeCompare(b.operador));
      setEvaluaciones(data);
    } catch (error) {
      toast.error("Error al cargar la información.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEvaluaciones();
  }, [date, userRole]);

  const handleSincronizar = async () => {
    if (!date) return;
    setIsSyncing(true);

    try {
      const dateDB = format(date, "yyyy-MM-dd");
      // 🔴 CORRECCIÓN: Ruta del API actualizada
      const response = await fetch("/api/sincronizar-evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: dateDB, rol: userRole }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("Día Sincronizado");
        await fetchEvaluaciones();
      } else {
        toast.warning("Aviso", { description: result.error });
      }
    } catch (error) {
      toast.error("Error al intentar sincronizar.");
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

  const handleActitudChange = (
    id: string,
    field: "puntualidad" | "proactividad",
    val: string,
  ) => {
    if (val === "") {
      handleUpdateLocal(id, field, "");
      return;
    }
    let num = parseInt(val, 10);
    if (num > 10) num = 10;
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
      return toast.warning("Campos incompletos");
    }
    try {
      const docRef = doc(db, "evaluaciones_desempeno", ev.id);
      await updateDoc(docRef, {
        puntualidad: Number(ev.puntualidad),
        proactividad: Number(ev.proactividad),
        completoTurno: ev.completoTurno,
        tuvoInconveniente: ev.tuvoInconveniente,
        comentarioInconveniente: ev.comentarioInconveniente,
        puntajeFinal: calcularPuntajeFinal(ev),
        estado: "Confirmado",
        confirmadoEl: new Date().toISOString(),
      });
      toast.success("Evaluación Confirmada");
      handleUpdateLocal(ev.id, "estado", "Confirmado");
    } catch (error) {
      toast.error("Error al confirmar.");
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 relative animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            Evaluación de Desempeño
          </h1>
          <p className="text-slate-500 mt-1 flex items-center text-sm uppercase font-semibold">
            <Globe className="w-4 h-4 mr-1 text-primary" />
            Panel{" "}
            {isAdmin
              ? "Administrador"
              : userRole === "agente_retiro_inter"
                ? "Internacional"
                : "Nacional"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[220px] justify-start text-left font-normal bg-white"
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
            Sincronizar Mi Grupo
          </Button>
        </div>
      </div>

      <Card className="shadow-md border-primary/10">
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
                        <div className="text-[10px] text-primary font-bold uppercase mt-1">
                          {ev.grupoMoneda || "Global"}
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
                          SLA: {ev.puntajeSla} /10
                          <br />
                          TMP: {ev.puntajeTiempo} /10
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
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
                            }
                            disabled={isConfirmado}
                            className="w-14 text-center border rounded py-1 text-sm disabled:bg-slate-100 focus:ring-2 focus:ring-primary outline-none"
                          />
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
                            }
                            disabled={isConfirmado}
                            className="w-14 text-center border rounded py-1 text-sm disabled:bg-slate-100 focus:ring-2 focus:ring-primary outline-none"
                          />
                        </div>
                      </TableCell>

                      {/* 🔴 RESTAURADO EXACTAMENTE COMO LO TENÍAS */}
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

                      {/* SOLO BOTÓN DE CONFIRMAR */}
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
                    No hay evaluaciones generadas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 🔴 MODAL RESTAURADO EXACTAMENTE COMO LO TENÍAS */}
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
