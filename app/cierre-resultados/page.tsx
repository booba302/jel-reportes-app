// src/app/cierre-resultados/page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

import {
  Trophy,
  AlertCircle,
  CheckCircle2,
  Lock,
  Loader2,
  CalendarDays,
  TrendingUp,
  Clock,
  Target,
  CalendarOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

export default function CierreMensualPage() {
  const [mesActual, setMesActual] = React.useState<string>(
    format(new Date(), "yyyy-MM"),
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  const [estadoAuditoria, setEstadoAuditoria] = React.useState<any>(null);
  const [reportesMensuales, setReportesMensuales] = React.useState<any[]>([]);
  const [mesCerrado, setMesCerrado] = React.useState(false);
  const [mesYaTermino, setMesYaTermino] = React.useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Validar restricción de tiempo
      const today = new Date();
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const haTerminado = mesActual < currentMonthStr;
      setMesYaTermino(haTerminado);

      // 2. Verificar si ya está cerrado oficialmente
      const qMensual = query(
        collection(db, "evaluaciones_mensuales"),
        where("mes", "==", mesActual),
      );
      const snapMensual = await getDocs(qMensual);

      if (!snapMensual.empty) {
        setMesCerrado(true);
        const dataMensual = snapMensual.docs.map((d) => d.data());
        dataMensual.sort((a, b) => b.notaFinalMes - a.notaFinalMes);
        setReportesMensuales(dataMensual);
        setEstadoAuditoria(null);
      } else {
        // 3. Si no está cerrado, cruzamos datos (Cargados vs Evaluados)
        setMesCerrado(false);
        setReportesMensuales([]);

        const fechaInicio = `${mesActual}-01T00:00:00.000Z`;
        const fechaFin = `${mesActual}-31T23:59:59.999Z`;

        const qHistorial = query(
          collection(db, "historial_reportes"),
          where("fechaReporte", ">=", fechaInicio),
          where("fechaReporte", "<=", fechaFin),
        );
        const snapHistorial = await getDocs(qHistorial);

        const qDiarias = query(
          collection(db, "evaluaciones_diarias"),
          where("fecha", ">=", fechaInicio),
          where("fecha", "<=", fechaFin),
        );
        const snapDiarias = await getDocs(qDiarias);

        const resumenMonedas: Record<
          string,
          {
            diasCargados: Set<string>;
            diasEvaluados: Set<string>;
            fechasConPendientes: Set<string>;
          }
        > = {};

        // A. Almacenar días cargados desde los Excels
        snapHistorial.docs.forEach((doc) => {
          const data = doc.data();
          if (!resumenMonedas[data.moneda])
            resumenMonedas[data.moneda] = {
              diasCargados: new Set(),
              diasEvaluados: new Set(),
              fechasConPendientes: new Set(),
            };
          resumenMonedas[data.moneda].diasCargados.add(data.fechaReporte);
        });

        // B. Almacenar el estatus de las evaluaciones diarias
        snapDiarias.docs.forEach((doc) => {
          const data = doc.data();
          if (!resumenMonedas[data.moneda])
            resumenMonedas[data.moneda] = {
              diasCargados: new Set(),
              diasEvaluados: new Set(),
              fechasConPendientes: new Set(),
            };

          if (data.estado === "Confirmado") {
            resumenMonedas[data.moneda].diasEvaluados.add(data.fecha);
          } else {
            resumenMonedas[data.moneda].fechasConPendientes.add(data.fecha);
          }
        });

        // C. Formatear para la UI
        const monedasUI: Record<string, any> = {};
        let totalInconsistencias = 0;

        Object.entries(resumenMonedas).forEach(([moneda, stats]) => {
          const totalCargados = stats.diasCargados.size;
          // Un día solo se considera Evaluado si no tiene a ningún operador pendiente en esa fecha
          const totalEvaluadosLimpios = [...stats.diasEvaluados].filter(
            (fecha) => !stats.fechasConPendientes.has(fecha),
          ).length;

          const completado =
            totalCargados > 0 && totalCargados === totalEvaluadosLimpios;
          if (!completado) totalInconsistencias++;

          monedasUI[moneda] = {
            cargados: totalCargados,
            evaluados: totalEvaluadosLimpios,
            completado,
          };
        });

        setEstadoAuditoria({
          monedas: monedasUI,
          totalInconsistencias,
          hayDatos: Object.keys(monedasUI).length > 0,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Error cargando información del mes.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [mesActual]);

  const handleCerrarMes = async () => {
    if (
      !confirm(
        `¿Estás seguro de cerrar el mes ${mesActual}? Esta acción generará los promedios definitivos y no se puede deshacer.`,
      )
    )
      return;

    setIsClosing(true);
    try {
      const response = await fetch("/api/cerrar-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: mesActual }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success("Mes Cerrado", { description: result.message });
        await fetchData();
      } else {
        toast.error("Cierre denegado", { description: result.error });
      }
    } catch (error) {
      toast.error("Error de red.");
    } finally {
      setIsClosing(false);
    }
  };

  const renderAuditoria = () => {
    if (!estadoAuditoria) return null;

    if (!estadoAuditoria.hayDatos) {
      return (
        <Card className="bg-slate-50 border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center p-10 text-slate-500">
            <CalendarDays className="w-10 h-10 mb-3 text-slate-300" />
            <p>No se han cargado archivos para el periodo {mesActual}</p>
          </CardContent>
        </Card>
      );
    }

    const inconsistencias = estadoAuditoria.totalInconsistencias > 0;
    // El sistema solo está listo si NO hay inconsistencias Y el mes ya terminó
    const estaListo = !inconsistencias && mesYaTermino;

    return (
      <Card
        className={cn(
          "border-2 shadow-md",
          estaListo ? "border-emerald-200" : "border-amber-200",
        )}
      >
        <CardHeader
          className={estaListo ? "bg-emerald-50/50" : "bg-amber-50/50"}
        >
          <CardTitle className="flex items-center gap-2">
            {estaListo ? (
              <CheckCircle2 className="text-emerald-500" />
            ) : (
              <AlertCircle className="text-amber-500" />
            )}
            Auditoría de Cierre
          </CardTitle>
          <CardDescription>
            {inconsistencias
              ? "Debes completar las evaluaciones diarias para igualar los reportes cargados."
              : !mesYaTermino
                ? "Las métricas están perfectas, pero debes esperar al mes siguiente para oficializar el cierre."
                : "Todo está evaluado correctamente. El mes está listo para cerrarse."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(estadoAuditoria.monedas).map(
              ([moneda, stats]: [string, any]) => {
                return (
                  <div
                    key={moneda}
                    className={cn(
                      "p-4 rounded-lg border",
                      stats.completado
                        ? "bg-white border-emerald-100"
                        : "bg-amber-50 border-amber-200",
                    )}
                  >
                    <div className="text-sm font-semibold text-slate-500 mb-1">
                      Moneda {moneda}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-800">
                        {stats.evaluados}
                      </span>
                      <span className="text-lg text-slate-400 font-normal">
                        / {stats.cargados}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
                      Días Evaluados
                    </div>

                    {!stats.completado && stats.cargados > 0 && (
                      <div className="text-xs font-semibold text-rose-600 mt-2">
                        Faltan {stats.cargados - stats.evaluados} días
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>

          <Button
            onClick={handleCerrarMes}
            disabled={!estaListo || isClosing}
            className={cn(
              "w-full h-12 text-lg transition-all",
              estaListo
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-400 border border-slate-200",
            )}
          >
            {isClosing ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : !mesYaTermino && !inconsistencias ? (
              <CalendarOff className="w-5 h-5 mr-2" />
            ) : (
              <Lock className="w-5 h-5 mr-2" />
            )}

            {!mesYaTermino && !inconsistencias
              ? "El cierre estará disponible el próximo mes"
              : "Generar Promedios y Cerrar Mes"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Cierre Mensual
          </h1>
          <p className="text-slate-500 mt-1">
            Revisión de métricas y evaluación final por operador.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-1 border rounded-lg">
          <span className="px-3 text-sm font-medium text-slate-600">
            Periodo:
          </span>
          <input
            type="month"
            value={mesActual}
            onChange={(e) => setMesActual(e.target.value)}
            className="border-none bg-transparent py-2 pr-4 text-sm font-semibold focus:ring-0 outline-none cursor-pointer"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {!mesCerrado && renderAuditoria()}

          {mesCerrado && reportesMensuales.length > 0 && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Trophy className="w-40 h-40" />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                  <div className="bg-amber-400 p-4 rounded-full shadow-lg shadow-amber-500/20">
                    <Trophy className="w-10 h-10 text-amber-900" />
                  </div>
                  <div>
                    <h2 className="text-amber-400 font-bold uppercase tracking-wider text-sm mb-1">
                      Mejor Rendimiento del Mes
                    </h2>
                    <div className="text-4xl font-extrabold">
                      {reportesMensuales[0].operador}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-slate-300 text-sm">
                      <span className="flex items-center">
                        <Target className="w-4 h-4 mr-1 text-emerald-400" />{" "}
                        Nota: {reportesMensuales[0].notaFinalMes}/10
                      </span>
                      <span className="flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1 text-blue-400" />{" "}
                        {reportesMensuales[0].totalRetiros} Retiros
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-violet-400" />{" "}
                        {reportesMensuales[0].promedioTiempoMin}m Promedio
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Resultados Finales - {mesActual}</CardTitle>
                  <CardDescription>
                    Promedios consolidados de todas las monedas operadas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="pl-6 font-semibold">
                          Operador
                        </TableHead>
                        <TableHead className="text-center">
                          Días Trabajados
                        </TableHead>
                        <TableHead className="text-center">
                          SLA Promedio
                        </TableHead>
                        <TableHead className="text-center">
                          Tiempo Promedio
                        </TableHead>
                        <TableHead className="text-center">
                          Puntaje Cuantitativo
                        </TableHead>
                        <TableHead className="text-center">
                          Puntaje Cualitativo
                        </TableHead>
                        <TableHead className="text-right pr-6 font-bold">
                          Nota Definitiva
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportesMensuales.map((rep, idx) => (
                        <TableRow
                          key={rep.id}
                          className={idx === 0 ? "bg-amber-50/30" : ""}
                        >
                          <TableCell className="pl-6 font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              {idx === 0 && (
                                <Trophy className="w-4 h-4 text-amber-500" />
                              )}
                              {rep.operador}
                            </div>
                            <div className="text-xs text-slate-500">
                              {rep.totalRetiros} retiros
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {rep.diasTrabajados}
                          </TableCell>
                          <TableCell className="text-center font-medium text-emerald-600">
                            {rep.promedioSlaPct}%
                          </TableCell>
                          <TableCell className="text-center font-medium text-blue-600">
                            {rep.promedioTiempoMin}m
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="text-xs text-slate-500">
                              SLA: {rep.promedioPuntajeSla} | TMP:{" "}
                              {rep.promedioPuntajeTiempo}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="text-xs text-slate-500">
                              Punt: {rep.promedioPuntualidad} | Proac:{" "}
                              {rep.promedioProactividad}
                            </div>
                            {rep.totalInconvenientes > 0 && (
                              <div className="text-[10px] text-amber-600 font-medium mt-1">
                                ({rep.totalInconvenientes} Inconvenientes)
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            <div
                              className={cn(
                                "text-xl font-bold",
                                rep.notaFinalMes >= 8
                                  ? "text-emerald-600"
                                  : rep.notaFinalMes >= 6
                                    ? "text-amber-500"
                                    : "text-rose-600",
                              )}
                            >
                              {rep.notaFinalMes.toFixed(1)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
