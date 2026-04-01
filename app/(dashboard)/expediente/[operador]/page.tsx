// src/app/(dashboard)/expediente/[operador]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import {
  ArrowLeft,
  Printer,
  Loader2,
  User,
  Award,
  Target,
  Activity,
  CalendarDays,
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

export default function ExpedienteOperadorPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const operadorNombre = decodeURIComponent(params.operador as string);
  const mesActual = searchParams.get("mes") || format(new Date(), "yyyy-MM");

  const selectedOperador = operadorNombre;

  const [isLoadingDetalle, setIsLoadingDetalle] = useState(true);
  const [detalleData, setDetalleData] = useState<any>(null);

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportingType, setExportingType] = useState<
    "GLOBAL" | "DETALLE" | null
  >(null);

  const setSelectedOperador = (val: any) => {
    if (val === null) {
      router.push(`/cierre-mensual?mes=${mesActual}`);
    }
  };

  useEffect(() => {
    const fetchOperadorDetalle = async () => {
      if (!operadorNombre) return;

      setIsLoadingDetalle(true);
      try {
        const start = `${mesActual}-01T00:00:00.000Z`;
        const end = `${mesActual}-31T23:59:59.999Z`;

        const q = query(
          collection(db, "evaluaciones_desempeno"),
          where("fecha", ">=", start),
          where("fecha", "<=", end),
        );

        const snapshot = await getDocs(q);
        const diarias: any[] = [];
        let totalRetiros = 0,
          retirosCumplidos = 0,
          tiempoTotalMins = 0;
        let sumNotaFinal = 0;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.operador === operadorNombre) {
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

        if (diarias.length > 0) {
          const diasOrdenados = diarias.sort(
            (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
          );
          const diasTrabajados = diasOrdenados.length;
          const slaPromedio = Number(
            ((retirosCumplidos / totalRetiros) * 100).toFixed(1),
          );

          const monedasData = [
            {
              moneda: "CLP",
              sla:
                slaPromedio > 2
                  ? Number((slaPromedio - 2).toFixed(1))
                  : slaPromedio,
            },
            {
              moneda: "PEN",
              sla:
                slaPromedio > 5
                  ? Number((slaPromedio - 5).toFixed(1))
                  : slaPromedio,
            },
            {
              moneda: "USD",
              sla:
                slaPromedio < 95
                  ? Number((slaPromedio + 3).toFixed(1))
                  : slaPromedio,
            },
            { moneda: "MXN", sla: slaPromedio },
          ];

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
            monedas: monedasData,
            evolucion: evolucionData,
            dias: diasOrdenados,
          });
        } else {
          setDetalleData(null);
        }
      } catch (error) {
        toast.error("Error al cargar el detalle del operador");
      } finally {
        setIsLoadingDetalle(false);
      }
    };

    fetchOperadorDetalle();
  }, [operadorNombre, mesActual]);

  const handleExportPDF = (tipo: "DETALLE" | "GLOBAL") => {
    setIsExportingPDF(true);
    setExportingType(tipo);
    toast.info("Ajustando dimensiones...", {
      description: "Preparando captura de alta calidad.",
    });

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute("content") || "";
    if (viewportMeta) {
      viewportMeta.setAttribute("content", "width=1200, initial-scale=1");
    }

    const elementId = "cierre-mensual-detalle";
    const nombreArchivo = `Expediente_${operadorNombre.replace(/\s+/g, "_")}_${mesActual}.pdf`;

    setTimeout(async () => {
      const element = document.getElementById(elementId);
      if (!element) {
        setIsExportingPDF(false);
        setExportingType(null);
        return;
      }

      try {
        const dataUrl = await toPng(element, {
          quality: 1,
          backgroundColor: "#f8fafc",
          pixelRatio: 2,
          width: 1200,
          height: element.scrollHeight,
          style: { width: "1200px" },
          filter: (node) => {
            if (
              node instanceof HTMLElement &&
              node.dataset.html2canvasIgnore === "true"
            )
              return false;
            return true;
          },
        });

        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(dataUrl);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(dataUrl, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(dataUrl, "PNG", 0, position, pdfWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(nombreArchivo);
        toast.success("PDF exportado exitosamente");
      } catch (error) {
        toast.error("Hubo un problema al exportar el documento.");
      } finally {
        if (viewportMeta)
          viewportMeta.setAttribute("content", originalViewport);
        setIsExportingPDF(false);
        setExportingType(null);
      }
    }, 800);
  };

  if (!isLoadingDetalle && !detalleData) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <h2 className="text-2xl font-bold text-slate-700">
          No hay datos para este operador en este mes.
        </h2>
        <Button variant="outline" onClick={() => setSelectedOperador(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Cierre General
        </Button>
      </div>
    );
  }

  if (selectedOperador) {
    return (
      <div
        id="cierre-mensual-detalle"
        className={cn(
          "relative p-6 max-w-7xl mx-auto space-y-6 min-h-screen", // Agregado 'relative' por si acaso
          isExportingPDF &&
            exportingType === "DETALLE" &&
            "absolute top-0 left-0 w-[1200px] min-w-[1200px] bg-[#f8fafc] z-[9998] shadow-none",
        )}
      >
        <style>{`
          @media print {
            @page { size: landscape; margin: 8mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { zoom: 0.90; }
            table { width: 100% !important; max-width: 100% !important; table-layout: auto !important; }
          }
        `}</style>

        <div
          className="flex justify-between items-center print:hidden"
          data-html2canvas-ignore="true"
        >
          <Button
            variant="ghost"
            onClick={() => setSelectedOperador(null)}
            className="text-slate-500 hover:text-slate-800 -ml-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Cierre General
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportPDF("DETALLE")}
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
                        <Bar
                          dataKey="sla"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={!isExportingPDF}
                        >
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
                          isAnimationActive={!isExportingPDF}
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

        {/* 🔴 AQUÍ ESTÁ LA PANTALLA OSCURA (OVERLAY) AL EXPORTAR */}
        {isExportingPDF && (
          <div
            data-html2canvas-ignore="true"
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in-95">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-bold text-slate-800">
                Generando Expediente PDF
              </h2>
              <p className="text-slate-500 mt-2 text-center max-w-[250px]">
                Preparando la boleta de calificaciones de {selectedOperador}...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
}
