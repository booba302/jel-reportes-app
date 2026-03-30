// src/app/cierre-mensual/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import * as xlsx from "xlsx";

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
  Download,
  Printer,
  Award,
  ArrowLeft,
  User,
  Activity,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { toast } from "sonner";

export default function CierreMensualPage() {
  const [mesActual, setMesActual] = useState<string>(
    format(new Date(), "yyyy-MM"),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [mesCerrado, setMesCerrado] = useState(false);
  const [mesYaTermino, setMesYaTermino] = useState(false);

  // Datos procesados Globales
  const [rawEvalsGuardados, setRawEvalsGuardados] = useState<any[]>([]);
  const [reportesMensuales, setReportesMensuales] = useState<any[]>([]);
  const [metricasGlobales, setMetricasGlobales] = useState<any>(null);
  const [estadoAuditoria, setEstadoAuditoria] = useState<any>(null);

  // Estados para el Perfil Detallado (Drill-down)
  const [selectedOperador, setSelectedOperador] = useState<string | null>(null);
  const [isLoadingDetalle, setIsLoadingDetalle] = useState(false);
  const [detalleData, setDetalleData] = useState<any>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      setMesYaTermino(mesActual < currentMonthStr);

      const start = `${mesActual}-01T00:00:00.000Z`;
      const end = `${mesActual}-31T23:59:59.999Z`;

      // Siempre buscamos las evaluaciones diarias para tenerlas listas para el desglose
      const q = query(
        collection(db, "evaluaciones_desempeno"),
        where("fecha", ">=", start),
        where("fecha", "<=", end),
      );
      const snapshot = await getDocs(q);
      const diarias: any[] = [];
      snapshot.forEach((docSnap) => diarias.push(docSnap.data()));
      setRawEvalsGuardados(diarias);

      const docCierreRef = doc(db, "evaluaciones_mensuales", mesActual);
      const docCierreSnap = await getDoc(docCierreRef);

      if (docCierreSnap.exists()) {
        const data = docCierreSnap.data();
        setMesCerrado(true);
        setReportesMensuales(data.ranking);
        setMetricasGlobales(data.metrics);
        setEstadoAuditoria(null);
      } else {
        setMesCerrado(false);
        const agtMap: Record<string, any> = {};
        let globalRetiros = 0,
          globalSlaCumplido = 0,
          globalTiempoMins = 0;
        let totalEvals = 0,
          confirmadas = 0,
          pendientes = 0;

        diarias.forEach((ev) => {
          totalEvals++;
          if (ev.estado === "Confirmado") confirmadas++;
          else pendientes++;

          const op = ev.operador;
          if (!agtMap[op]) {
            agtMap[op] = {
              operador: op,
              diasTrabajados: 0,
              totalRetiros: 0,
              retirosCumplidos: 0,
              tiempoTotalMins: 0,
              sumPuntualidad: 0,
              sumProactividad: 0,
              sumNotaFinal: 0,
              inconvenientes: 0,
              turnosIncompletos: 0,
            };
          }

          const retirosCumplidosDia = Math.round(
            (ev.cumplimientoSlaPct / 100) * ev.totalRetiros,
          );
          const tiempoTotalDia = ev.tiempoPromedioMin * ev.totalRetiros;

          globalRetiros += ev.totalRetiros;
          globalSlaCumplido += retirosCumplidosDia;
          globalTiempoMins += tiempoTotalDia;

          agtMap[op].diasTrabajados++;
          agtMap[op].totalRetiros += ev.totalRetiros;
          agtMap[op].retirosCumplidos += retirosCumplidosDia;
          agtMap[op].tiempoTotalMins += tiempoTotalDia;
          agtMap[op].sumPuntualidad += Number(ev.puntualidad) || 0;
          agtMap[op].sumProactividad += Number(ev.proactividad) || 0;
          agtMap[op].sumNotaFinal += Number(ev.puntajeFinal) || 0;
          if (ev.tuvoInconveniente) agtMap[op].inconvenientes++;
          if (!ev.completoTurno) agtMap[op].turnosIncompletos++;
        });

        const ranking = Object.values(agtMap)
          .map((agt) => {
            const dias = agt.diasTrabajados;
            return {
              ...agt,
              slaPromedio:
                agt.totalRetiros > 0
                  ? Number(
                      ((agt.retirosCumplidos / agt.totalRetiros) * 100).toFixed(
                        1,
                      ),
                    )
                  : 0,
              tiempoPromedio:
                agt.totalRetiros > 0
                  ? Number((agt.tiempoTotalMins / agt.totalRetiros).toFixed(1))
                  : 0,
              puntualidadPromedio: Number(
                (agt.sumPuntualidad / dias).toFixed(1),
              ),
              proactividadPromedio: Number(
                (agt.sumProactividad / dias).toFixed(1),
              ),
              notaFinalPromedio: Number((agt.sumNotaFinal / dias).toFixed(1)),
            };
          })
          .sort((a, b) => b.notaFinalPromedio - a.notaFinalPromedio);

        setReportesMensuales(ranking);
        setMetricasGlobales({
          totalOps: globalRetiros,
          slaGlobal:
            globalRetiros > 0
              ? ((globalSlaCumplido / globalRetiros) * 100).toFixed(1)
              : "0.0",
          tiempoGlobal:
            globalRetiros > 0
              ? (globalTiempoMins / globalRetiros).toFixed(1)
              : "0.0",
        });
        setEstadoAuditoria({
          totalEvals,
          confirmadas,
          pendientes,
          hayDatos: totalEvals > 0,
        });
      }
    } catch (error) {
      toast.error("Error cargando información del mes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setSelectedOperador(null);
  }, [mesActual]);

  const handleCerrarMes = async () => {
    if (!confirm(`¿Estás seguro de cerrar el mes ${mesActual}?`)) return;
    setIsClosing(true);
    try {
      await setDoc(doc(db, "evaluaciones_mensuales", mesActual), {
        mes: mesActual,
        cerradoEl: new Date().toISOString(),
        metrics: metricasGlobales,
        ranking: reportesMensuales,
      });
      toast.success("Mes Cerrado", {
        description: "Los promedios mensuales han sido guardados.",
      });
      await fetchData();
    } catch (error) {
      toast.error("Error al cerrar el mes en Firebase.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleVerDetalle = async (operador: string) => {
    setSelectedOperador(operador);
    setIsLoadingDetalle(true);
    try {
      const diasTrabajados = rawEvalsGuardados
        .filter((ev) => ev.operador === operador)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      const start = `${mesActual}-01T00:00:00.000Z`;
      const end = `${mesActual}-31T23:59:59.999Z`;

      const qOps = query(
        collection(db, "operaciones_retiros"),
        where("Fecha del reporte", ">=", start),
        where("Fecha del reporte", "<=", end),
      );

      const snapOps = await getDocs(qOps);
      const monedaMap: Record<
        string,
        { total: number; cumple: number; tiempoTotal: number }
      > = {};

      snapOps.forEach((docItem) => {
        const data = docItem.data();
        if (data.Operador !== operador) return;

        const mon = data.Moneda || "N/A";
        if (!monedaMap[mon])
          monedaMap[mon] = { total: 0, cumple: 0, tiempoTotal: 0 };

        monedaMap[mon].total++;
        monedaMap[mon].tiempoTotal += Number(data.Tiempo) || 0;
        if (data.Cumple === true) monedaMap[mon].cumple++;
      });

      const statsMonedas = Object.keys(monedaMap)
        .map((m) => ({
          moneda: m,
          volumen: monedaMap[m].total,
          sla: Number(
            ((monedaMap[m].cumple / monedaMap[m].total) * 100).toFixed(1),
          ),
          tiempoPromedio: Number(
            (monedaMap[m].tiempoTotal / monedaMap[m].total).toFixed(1),
          ),
        }))
        .sort((a, b) => b.volumen - a.volumen);

      const evolucion = diasTrabajados.map((d) => ({
        fecha: d.fecha.split("T")[0].split("-").slice(1).reverse().join("/"),
        Nota: Number(d.puntajeFinal.toFixed(1)), // CORRECCIÓN PARA RECHARTS
        SLA: d.cumplimientoSlaPct,
      }));

      const promedios = reportesMensuales.find((r) => r.operador === operador);

      setDetalleData({
        dias: diasTrabajados,
        monedas: statsMonedas,
        evolucion,
        promedios,
      });
    } catch (error) {
      console.error("Error cargando detalle:", error);
      toast.error("Error al cargar el expediente del operador.");
    } finally {
      setIsLoadingDetalle(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = reportesMensuales.map((r) => ({
      Operador: r.operador,
      "Días Trabajados": r.diasTrabajados,
      "Total Retiros": r.totalRetiros,
      "SLA Mensual (%)": r.slaPromedio,
      "Tiempo Prom. (min)": r.tiempoPromedio,
      "Puntualidad Prom.": r.puntualidadPromedio,
      "Proactividad Prom.": r.proactividadPromedio,
      "Nota Final Mensual": r.notaFinalPromedio,
      "Días con Inconvenientes": r.inconvenientes,
    }));
    const ws = xlsx.utils.json_to_sheet(dataToExport);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Cierre");
    xlsx.writeFile(wb, `Cierre_Mensual_${mesActual}.xlsx`);
  };

  const handlePrintPDF = () => window.print();

  // RENDER: VISTA DEL EXPEDIENTE DETALLADO (Drill-down)
  if (selectedOperador) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-500 print:p-0 print:max-w-full print:bg-white">
        <style>{`
          @media print {
            @page { size: landscape; margin: 8mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { zoom: 0.90; }
            table { width: 100% !important; max-width: 100% !important; table-layout: auto !important; }
          }
        `}</style>

        <div className="flex justify-between items-center print:hidden">
          <Button
            variant="ghost"
            onClick={() => setSelectedOperador(null)}
            className="text-slate-500 hover:text-slate-800 -ml-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Cierre General
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintPDF}
            className="border-slate-200 text-slate-700 hover:text-blue-700 hover:bg-blue-50"
          >
            <Printer className="w-4 h-4 mr-2 text-blue-600" /> Imprimir
            Expediente
          </Button>
        </div>

        {isLoadingDetalle || !detalleData ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4 bg-white p-6 rounded-xl border shadow-sm print:border-none print:shadow-none print:p-0">
              <div className="bg-blue-100 p-4 rounded-full print:bg-transparent print:p-0">
                <User className="w-10 h-10 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {selectedOperador}
                </h1>
                <p className="text-slate-500">
                  Expediente de Rendimiento • {mesActual}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      Nota Mensual
                    </p>
                    <Award className="w-4 h-4 text-amber-500" />
                  </div>
                  <div
                    className={`text-3xl font-bold mt-2 ${detalleData.promedios.notaFinalPromedio >= 8 ? "text-emerald-600" : detalleData.promedios.notaFinalPromedio >= 6 ? "text-amber-500" : "text-rose-600"}`}
                  >
                    {detalleData.promedios.notaFinalPromedio}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      SLA Ponderado
                    </p>
                    <Target className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-2">
                    {detalleData.promedios.slaPromedio}%
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      Retiros Totales
                    </p>
                    <Activity className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-2">
                    {detalleData.promedios.totalRetiros.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      Días Trabajados
                    </p>
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-2">
                    {detalleData.promedios.diasTrabajados}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
              <Card className="shadow-sm border-slate-200 print:break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-700">
                    SLA por Moneda (Cuellos de botella)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={detalleData.monedas}
                        margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="moneda"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          domain={[0, 100]}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "#f1f5f9" }}
                          formatter={(value: any) => [
                            `${value}%`,
                            "SLA Cumplido",
                          ]}
                        />
                        <Bar dataKey="sla" radius={[4, 4, 0, 0]}>
                          {detalleData.monedas.map(
                            (entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.sla >= 90
                                    ? "#10b981"
                                    : entry.sla >= 75
                                      ? "#3b82f6"
                                      : "#ef4444"
                                }
                              />
                            ),
                          )}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 print:break-inside-avoid print:mt-6">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-700">
                    Evolución de Nota Diaria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={detalleData.evolucion}
                        margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="fecha"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          domain={[0, 10]}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Nota"
                          stroke="#8b5cf6"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border-slate-200 print:break-inside-avoid print:shadow-none print:border-none print:mt-6">
              <CardHeader className="bg-slate-50/50 border-b pb-4 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0">
                <CardTitle className="text-base font-semibold text-slate-700 print:text-black">
                  Desglose Diario de Puntuación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 print:pt-4">
                <div className="overflow-x-auto print:overflow-visible print:w-full print:max-w-full">
                  <table className="w-full text-sm text-left print:text-xs">
                    <thead className="text-xs text-slate-500 uppercase bg-white border-b print:text-black print:border-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-semibold print:px-2 print:py-2">
                          Fecha
                        </th>
                        <th className="px-4 py-4 font-semibold text-center print:px-2 print:py-2">
                          Volumen
                        </th>
                        <th className="px-4 py-4 font-semibold text-center print:px-2 print:py-2">
                          SLA
                        </th>
                        <th className="px-4 py-4 font-semibold text-center print:px-2 print:py-2">
                          Tiempo Prom.
                        </th>
                        <th className="px-4 py-4 font-semibold text-center print:px-2 print:py-2">
                          Actitud
                        </th>
                        <th className="px-4 py-4 font-semibold text-center border-l print:px-2 print:py-2">
                          Nota del Día
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleData.dias.map((dia: any, i: number) => (
                        <tr
                          key={i}
                          className="border-b hover:bg-slate-50/50 print:border-slate-300"
                        >
                          <td className="px-6 py-3 font-medium text-slate-800 print:px-2 print:py-2 print:text-black">
                            {format(
                              parseISO(dia.fecha.split("T")[0]),
                              "dd 'de' MMM",
                              { locale: es },
                            )}
                            {dia.tuvoInconveniente && (
                              <div className="text-[10px] text-amber-600 font-normal mt-0.5 border border-amber-200 bg-amber-50 px-1 rounded inline-block">
                                Tuvo Inconveniente
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 print:px-2 print:py-2">
                            {dia.totalRetiros}
                          </td>
                          <td className="px-4 py-3 text-center print:px-2 print:py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${dia.cumplimientoSlaPct >= 90 ? "bg-emerald-100 text-emerald-700 print:border print:border-emerald-300" : dia.cumplimientoSlaPct >= 75 ? "bg-amber-100 text-amber-700 print:border print:border-amber-300" : "bg-rose-100 text-rose-700 print:border print:border-rose-300"}`}
                            >
                              {dia.cumplimientoSlaPct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 print:px-2 print:py-2">
                            {dia.tiempoPromedioMin}m
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500 print:px-2 print:py-2">
                            Punt:{" "}
                            <span className="font-semibold text-slate-700 print:text-black">
                              {dia.puntualidad}
                            </span>{" "}
                            | Pro:{" "}
                            <span className="font-semibold text-slate-700 print:text-black">
                              {dia.proactividad}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center border-l bg-slate-50/30 print:px-2 print:py-2 print:bg-transparent">
                            <span
                              className={`text-lg font-bold ${dia.puntajeFinal >= 8 ? "text-emerald-600" : dia.puntajeFinal >= 6 ? "text-amber-500" : "text-rose-600"}`}
                            >
                              {dia.puntajeFinal.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // RENDER: VISTA NORMAL (Cierre Mensual General)
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 print:p-0 print:max-w-full print:bg-white">
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { zoom: 0.90; }
          table { width: 100% !important; max-width: 100% !important; table-layout: auto !important; }
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Award className="w-8 h-8 text-primary" /> Cierre Mensual
          </h1>
          <p className="text-slate-500 mt-1">
            Revisión de métricas exactas y evaluación final por operador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
          {mesCerrado && (
            <>
              <Button
                variant="outline"
                onClick={handleExportExcel}
                className="h-10 border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="w-4 h-4 mr-2 text-emerald-600" /> XLSX
              </Button>
              <Button
                variant="outline"
                onClick={handlePrintPDF}
                className="h-10 border-slate-200 text-slate-700 hover:text-rose-700 hover:bg-rose-50"
              >
                <Printer className="w-4 h-4 mr-2 text-rose-600" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {!mesCerrado && estadoAuditoria && (
            <Card
              className={cn(
                "border-2 shadow-md animate-in fade-in",
                estadoAuditoria.pendientes === 0 && mesYaTermino
                  ? "border-emerald-200"
                  : "border-amber-200",
              )}
            >
              <CardHeader
                className={
                  estadoAuditoria.pendientes === 0 && mesYaTermino
                    ? "bg-emerald-50/50"
                    : "bg-amber-50/50"
                }
              >
                <CardTitle className="flex items-center gap-2">
                  {estadoAuditoria.pendientes === 0 && mesYaTermino ? (
                    <CheckCircle2 className="text-emerald-500" />
                  ) : (
                    <AlertCircle className="text-amber-500" />
                  )}
                  Auditoría de Pre-Cierre
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg border bg-slate-50 border-slate-200">
                    <div className="text-sm font-semibold text-slate-500 mb-1">
                      Días Evaluados
                    </div>
                    <div className="text-3xl font-bold text-slate-800">
                      {estadoAuditoria.totalEvals}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-emerald-50 border-emerald-200">
                    <div className="text-sm font-semibold text-emerald-600 mb-1">
                      Confirmados
                    </div>
                    <div className="text-3xl font-bold text-emerald-700">
                      {estadoAuditoria.confirmadas}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "p-4 rounded-lg border",
                      estadoAuditoria.pendientes > 0
                        ? "bg-amber-50 border-amber-300 shadow-sm"
                        : "bg-slate-50 border-slate-200",
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-semibold mb-1",
                        estadoAuditoria.pendientes > 0
                          ? "text-amber-700"
                          : "text-slate-500",
                      )}
                    >
                      Pendientes
                    </div>
                    <div
                      className={cn(
                        "text-3xl font-bold",
                        estadoAuditoria.pendientes > 0
                          ? "text-amber-600"
                          : "text-slate-400",
                      )}
                    >
                      {estadoAuditoria.pendientes}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleCerrarMes}
                  disabled={
                    estadoAuditoria.pendientes > 0 || !mesYaTermino || isClosing
                  }
                  className={cn(
                    "w-full h-12 text-lg transition-all",
                    estadoAuditoria.pendientes === 0 && mesYaTermino
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      : "bg-slate-100 text-slate-400 border border-slate-200",
                  )}
                >
                  {isClosing ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Lock className="w-5 h-5 mr-2" />
                  )}
                  Generar Promedios Definitivos y Cerrar Mes
                </Button>
              </CardContent>
            </Card>
          )}

          {mesCerrado && reportesMensuales.length > 0 && metricasGlobales && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 pb-12">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-8 text-white shadow-xl relative overflow-hidden print:break-inside-avoid print:shadow-none print:border-none">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Trophy className="w-40 h-40" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="bg-amber-400 p-4 rounded-full shadow-lg shadow-amber-500/20">
                    <Trophy className="w-10 h-10 text-amber-900" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-amber-400 font-bold uppercase tracking-wider text-sm mb-1">
                      Mejor Rendimiento del Mes
                    </h2>
                    <div className="text-4xl font-extrabold">
                      {reportesMensuales[0].operador}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-slate-300 text-sm">
                      <span className="flex items-center">
                        <Target className="w-4 h-4 mr-1 text-emerald-400" />{" "}
                        Nota: {reportesMensuales[0].notaFinalPromedio}/10
                      </span>
                      <span className="flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1 text-blue-400" />{" "}
                        {reportesMensuales[0].totalRetiros.toLocaleString()}{" "}
                        Retiros
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:flex gap-4 border-l border-slate-700 pl-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">
                        {metricasGlobales.totalOps.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                        Retiros Totales
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {metricasGlobales.slaGlobal}%
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                        SLA Equipo
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="shadow-lg border-slate-200 print:break-inside-avoid print:shadow-none print:border-none">
                <CardHeader className="bg-slate-50/50 border-b pb-4 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0">
                  <CardTitle className="text-base font-semibold text-slate-700 print:text-black">
                    Boleta de Calificaciones Oficial
                  </CardTitle>
                  <CardDescription className="print:text-slate-700">
                    Haz clic en el nombre de un operador para ver su rendimiento
                    detallado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 print:pt-4">
                  <div className="overflow-x-auto print:overflow-visible print:w-full print:max-w-full">
                    <table className="w-full text-sm text-left print:text-xs">
                      <thead className="text-xs text-slate-500 uppercase bg-white border-b print:text-black print:border-slate-400">
                        <tr>
                          <th className="px-6 py-4 font-semibold print:px-2 print:py-2">
                            Operador
                          </th>
                          <th className="px-4 py-4 font-semibold text-center print:px-2 print:py-2">
                            Asistencia
                          </th>
                          <th className="px-4 py-4 font-semibold text-center print:px-2 print:py-2">
                            SLA Mensual
                          </th>
                          <th className="px-4 py-4 font-semibold text-center print:px-2 print:py-2">
                            Tiempo Prom.
                          </th>
                          <th className="px-4 py-4 font-semibold text-center border-l bg-slate-50 print:bg-transparent print:px-2 print:py-2">
                            Nota Definitiva
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportesMensuales.map((rep, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              "border-b hover:bg-slate-50/50 transition-colors print:border-slate-300",
                              idx === 0
                                ? "bg-amber-50/20 print:bg-amber-50/40"
                                : "",
                            )}
                          >
                            <td
                              className="px-6 py-4 print:px-2 print:py-2 cursor-pointer hover:bg-blue-50 transition-colors group"
                              onClick={() => handleVerDetalle(rep.operador)}
                            >
                              <div className="flex items-center gap-2 font-bold text-blue-600 group-hover:text-blue-800 underline-offset-4 group-hover:underline print:text-black print:no-underline">
                                {idx === 0 && (
                                  <Trophy className="w-4 h-4 text-amber-500 print:hidden" />
                                )}
                                {rep.operador}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 font-medium print:text-slate-600">
                                {rep.totalRetiros.toLocaleString()} retiros
                                totales
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center print:px-2 print:py-2">
                              <div className="text-slate-700 font-bold print:text-black">
                                {rep.diasTrabajados} días
                              </div>
                              {rep.turnosIncompletos > 0 && (
                                <div className="text-[10px] text-amber-600 mt-1 print:text-amber-700">
                                  ({rep.turnosIncompletos} salidas)
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-center print:px-2 print:py-2">
                              <span
                                className={`px-2.5 py-1 rounded text-xs font-bold ${rep.slaPromedio >= 90 ? "bg-emerald-100 text-emerald-700 print:border print:border-emerald-300" : rep.slaPromedio >= 75 ? "bg-amber-100 text-amber-700 print:border print:border-amber-300" : "bg-rose-100 text-rose-700 print:border print:border-rose-300"}`}
                              >
                                {rep.slaPromedio}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-slate-600 print:px-2 print:py-2 print:text-black">
                              {rep.tiempoPromedio} min
                            </td>
                            <td className="px-4 py-4 text-center border-l bg-slate-50/50 print:bg-transparent print:border-slate-300 print:px-2 print:py-2">
                              <div
                                className={`text-2xl font-black ${rep.notaFinalPromedio >= 8 ? "text-emerald-600 print:text-emerald-700" : rep.notaFinalPromedio >= 6 ? "text-amber-500 print:text-amber-600" : "text-rose-600 print:text-rose-700"}`}
                              >
                                {rep.notaFinalPromedio.toFixed(1)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
