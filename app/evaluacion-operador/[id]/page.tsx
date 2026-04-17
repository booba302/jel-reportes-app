// src/app/evaluacion-operador/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

import {
  Printer,
  Loader2,
  User,
  Award,
  Target,
  Activity,
  CalendarDays,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

export default function VisorExpedienteOperador() {
  const params = useParams();
  const idEnlace = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [errorAcceso, setErrorAcceso] = useState(false);
  const [operadorNombre, setOperadorNombre] = useState("");
  const [mesActual, setMesActual] = useState("");
  const [detalleData, setDetalleData] = useState<any>(null);

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  useEffect(() => {
    const fetchDatosPorEnlace = async () => {
      if (!idEnlace) return;
      setIsLoading(true);

      try {
        // 1. Validar el enlace
        const docEnlaceRef = doc(db, "enlaces_expedientes", idEnlace);
        const enlaceSnap = await getDoc(docEnlaceRef);

        if (!enlaceSnap.exists()) {
          setErrorAcceso(true);
          setIsLoading(false);
          return;
        }

        const opNombre = enlaceSnap.data().operador;
        const mes = enlaceSnap.data().mes;
        setOperadorNombre(opNombre);
        setMesActual(mes);

        // 2. Extraer métricas (Misma lógica de tu expediente)
        const start = `${mes}-01T00:00:00.000Z`;
        const end = `${mes}-31T23:59:59.999Z`;

        const qEvals = query(
          collection(db, "evaluaciones_desempeno"),
          where("fecha", ">=", start),
          where("fecha", "<=", end),
        );

        const snapshotEvals = await getDocs(qEvals);
        const diarias: any[] = [];
        let totalRetiros = 0,
          retirosCumplidos = 0,
          tiempoTotalMins = 0,
          sumNotaFinal = 0;

        snapshotEvals.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.operador === opNombre) {
            diarias.push(data);
            const retirosCumplidosDia = Math.round(
              (data.cumplimientoSlaPct / 100) * data.totalRetiros,
            );
            const tiempoTotalDia = data.tiempoPromedioMin * data.totalRetiros;
            totalRetiros += data.totalRetiros;
            retirosCumplidos += retirosCumplidosDia;
            tiempoTotalMins += tiempoTotalDia;
            sumNotaFinal += Number(data.puntajeFinal) || 0;
          }
        });

        const qRetiros = query(
          collection(db, "operaciones_retiros"),
          where("Fecha del reporte", ">=", start),
          where("Fecha del reporte", "<=", end),
        );

        const snapshotRetiros = await getDocs(qRetiros);
        const monedasMap: Record<string, { total: number; cumple: number }> =
          {};

        snapshotRetiros.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.Operador === opNombre) {
            const moneda = data.Moneda || "OTRA";
            if (!monedasMap[moneda])
              monedasMap[moneda] = { total: 0, cumple: 0 };
            monedasMap[moneda].total += 1;
            if (data.Cumple === true) monedasMap[moneda].cumple += 1;
          }
        });

        const monedasDataReales = Object.keys(monedasMap)
          .map((moneda) => {
            const { total, cumple } = monedasMap[moneda];
            return {
              moneda,
              sla: total > 0 ? Number(((cumple / total) * 100).toFixed(1)) : 0,
            };
          })
          .sort((a, b) => b.sla - a.sla);

        if (diarias.length > 0) {
          const diasOrdenados = diarias.sort(
            (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
          );
          const diasTrabajados = diasOrdenados.length;
          const slaPromedio = Number(
            ((retirosCumplidos / totalRetiros) * 100).toFixed(1),
          );

          const evolucionData = diasOrdenados.map((d) => ({
            fecha: format(parseISO(d.fecha.split("T")[0]), "dd/MM"),
            Nota: Number(d.puntajeFinal),
          }));

          setDetalleData({
            promedios: {
              notaFinalPromedio: Number(
                (sumNotaFinal / diasTrabajados).toFixed(1),
              ),
              slaPromedio: slaPromedio,
              totalRetiros: totalRetiros,
              diasTrabajados: diasTrabajados,
            },
            monedas:
              monedasDataReales.length > 0
                ? monedasDataReales
                : [{ moneda: "Sin Datos", sla: 0 }],
            evolucion: evolucionData,
            dias: diasOrdenados,
          });
        }
      } catch (error) {
        toast.error("Hubo un error cargando el expediente.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDatosPorEnlace();
  }, [idEnlace]);

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    toast.info("Ajustando documento...");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    setTimeout(async () => {
      const element = document.getElementById("expediente-readonly");
      if (!element) {
        setIsExportingPDF(false);
        return;
      }
      try {
        const dataUrl = await toPng(element, {
          quality: 1,
          backgroundColor: "#f8fafc",
          pixelRatio: 2,
        });
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(dataUrl);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, imgHeight);
        pdf.save(`Mi_Evaluacion_${mesActual}.pdf`);
        toast.success("PDF exportado exitosamente");
      } catch (error) {
        toast.error("Error al exportar el documento.");
      } finally {
        setIsExportingPDF(false);
      }
    }, 800);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold text-slate-600">
          Cargando tu evaluación...
        </h2>
      </div>
    );
  }

  if (errorAcceso) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-20 h-20 text-rose-300 mb-6" />
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Enlace no válido
        </h1>
        <p className="text-slate-500 max-w-md">
          Este enlace es incorrecto, ha expirado o no tienes permisos para ver
          esta información. Solicita un nuevo enlace a tu supervisor.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div
        id="expediente-readonly"
        className={cn(
          "max-w-5xl mx-auto space-y-6",
          isExportingPDF && "w-[1200px] min-w-[1200px] bg-slate-50 shadow-none",
        )}
      >
        <div
          className="flex justify-between items-center print:hidden"
          data-html2canvas-ignore="true"
        >
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Portal del Operador
            </h2>
          </div>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="border-slate-200 text-slate-700 hover:text-blue-700 hover:bg-blue-50 bg-white"
          >
            <Printer className="w-4 h-4 mr-2 text-blue-600" /> Descargar mi PDF
          </Button>
        </div>

        <div className="flex items-center gap-4 bg-white p-6 rounded-xl border shadow-sm print:border-none print:shadow-none print:p-0">
          <div className="bg-blue-100 p-4 rounded-full print:bg-transparent print:p-0">
            <User className="w-10 h-10 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {operadorNombre}
            </h1>
            <p className="text-slate-500">
              Expediente de Rendimiento Oficial • {mesActual}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-slate-200 bg-white print:break-inside-avoid">
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
          <Card className="shadow-sm border-slate-200 bg-white print:break-inside-avoid">
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
          <Card className="shadow-sm border-slate-200 bg-white print:break-inside-avoid">
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
          <Card className="shadow-sm border-slate-200 bg-white print:break-inside-avoid">
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
          <Card className="shadow-sm border-slate-200 bg-white print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-700">
                Mi SLA por Moneda
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
                      formatter={(value: any) => [`${value}%`, "SLA"]}
                    />
                    <Bar
                      dataKey="sla"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!isExportingPDF}
                    >
                      {detalleData.monedas.map((entry: any, index: number) => (
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
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 bg-white print:break-inside-avoid print:mt-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-700">
                Mi Evolución de Nota Diaria
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
                      isAnimationActive={!isExportingPDF}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-slate-200 bg-white print:break-inside-avoid print:shadow-none print:border-none print:mt-6">
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
                          className={`px-2 py-0.5 rounded text-xs font-bold ${dia.cumplimientoSlaPct >= 90 ? "bg-emerald-100 text-emerald-700" : dia.cumplimientoSlaPct >= 75 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}
                        >
                          {dia.cumplimientoSlaPct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 print:px-2 print:py-2">
                        {dia.tiempoPromedioMin}m
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500 print:px-2 print:py-2">
                        Punt:{" "}
                        <span className="font-semibold text-slate-700">
                          {dia.puntualidad}
                        </span>{" "}
                        | Pro:{" "}
                        <span className="font-semibold text-slate-700">
                          {dia.proactividad}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-l bg-slate-50/30 print:px-2 print:py-2">
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
    </div>
  );
}
