// src/app/monitor-regional/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";

// PDF EXPORT IMPORTS
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

import {
  Globe,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Target,
  Clock,
  Printer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function MonitorRegionalPage() {
  const [mesActual, setMesActual] = useState<string>(
    format(new Date(), "yyyy-MM"),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [datosRegiones, setDatosRegiones] = useState<any[]>([]);
  const [metricasGlobales, setMetricasGlobales] = useState<any>(null);

  // --- ESTADOS PARA PDF ---
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  useEffect(() => {
    fetchDatosRegiones();
  }, [mesActual]);

  const fetchDatosRegiones = async () => {
    setIsLoading(true);
    try {
      const start = `${mesActual}-01T00:00:00.000Z`;
      const end = `${mesActual}-31T23:59:59.999Z`;

      const qOps = query(
        collection(db, "operaciones_retiros"),
        where("Fecha del reporte", ">=", start),
        where("Fecha del reporte", "<=", end),
      );

      const snapOps = await getDocs(qOps);

      const mapaRegiones: Record<
        string,
        { total: number; cumple: number; tiempoTotal: number }
      > = {};
      let totalRetirosGlobal = 0;
      let totalCumpleGlobal = 0;
      let tiempoTotalGlobal = 0;

      snapOps.forEach((docItem) => {
        const data = docItem.data();
        // Usamos el campo Moneda como indicador de la región (VES, PEN, CLP, etc.)
        const region = data.Moneda || "N/A";

        if (region === "N/A" || !region) return;

        if (!mapaRegiones[region]) {
          mapaRegiones[region] = { total: 0, cumple: 0, tiempoTotal: 0 };
        }

        const tiempoOp = Number(data.Tiempo) || 0;
        const cumpleSla = data.Cumple === true;

        mapaRegiones[region].total++;
        mapaRegiones[region].tiempoTotal += tiempoOp;
        if (cumpleSla) mapaRegiones[region].cumple++;

        totalRetirosGlobal++;
        tiempoTotalGlobal += tiempoOp;
        if (cumpleSla) totalCumpleGlobal++;
      });

      const arrayRegiones = Object.keys(mapaRegiones)
        .map((r) => {
          const stats = mapaRegiones[r];
          return {
            region: r,
            volumen: stats.total,
            sla: Number(((stats.cumple / stats.total) * 100).toFixed(1)),
            tiempoPromedio: Number(
              (stats.tiempoTotal / stats.total).toFixed(1),
            ),
          };
        })
        .sort((a, b) => b.volumen - a.volumen);

      setDatosRegiones(arrayRegiones);

      if (totalRetirosGlobal > 0) {
        setMetricasGlobales({
          volumenTotal: totalRetirosGlobal,
          slaGlobal: Number(
            ((totalCumpleGlobal / totalRetirosGlobal) * 100).toFixed(1),
          ),
          tiempoGlobal: Number(
            (tiempoTotalGlobal / totalRetirosGlobal).toFixed(1),
          ),
          regionFuerte: arrayRegiones.reduce((prev, current) =>
            prev.sla > current.sla ? prev : current,
          ),
          regionRiesgo: arrayRegiones.reduce((prev, current) =>
            prev.sla < current.sla ? prev : current,
          ),
        });
      } else {
        setMetricasGlobales(null);
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
      toast.error("Error al cargar la información regional");
    } finally {
      setIsLoading(false);
    }
  };

  // --- MOTOR DEFINITIVO ANTI-RECORTE ---
  const handleExportPDF = () => {
    setIsExportingPDF(true);
    toast.info("Ajustando dimensiones...", {
      description: "Preparando captura de alta calidad.",
    });

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute("content") || "";
    if (viewportMeta) {
      viewportMeta.setAttribute("content", "width=1200, initial-scale=1");
    }

    setTimeout(async () => {
      const element = document.getElementById("monitor-regional-global");
      if (!element) {
        setIsExportingPDF(false);
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

        pdf.save(`Monitor_Regional_${mesActual}.pdf`);
        toast.success("PDF exportado exitosamente");
      } catch (error) {
        console.error("Error generando PDF:", error);
        toast.error("Hubo un problema al exportar el documento.");
      } finally {
        if (viewportMeta)
          viewportMeta.setAttribute("content", originalViewport);
        setIsExportingPDF(false);
      }
    }, 800);
  };

  return (
    <>
      {/* PANTALLA DE CARGA DEL PDF INVISIBLE PARA LA CÁMARA */}
      {isExportingPDF && (
        <div
          data-html2canvas-ignore="true"
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center"
        >
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-bold text-slate-800">
              Generando Monitor Regional
            </h2>
            <p className="text-slate-500 mt-2 text-center max-w-[250px]">
              Ajustando pantalla y tablas para formato de escritorio...
            </p>
          </div>
        </div>
      )}

      <div
        id="monitor-regional-global"
        className={cn(
          "p-6 mx-auto space-y-8 min-h-screen",
          isExportingPDF
            ? "absolute top-0 left-0 w-[1200px] min-w-[1200px] bg-[#f8fafc] z-[9998] shadow-none"
            : "max-w-7xl animate-in fade-in duration-500",
        )}
      >
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Globe className="w-8 h-8 text-blue-600" /> Monitor Regional
            </h1>
            <p className="text-slate-500 mt-1">
              Desempeño operativo, SLA y cuellos de botella clasificados por
              región.
            </p>
          </div>

          {/* BOTONERA IGNORADA POR EL PDF */}
          <div
            className="flex items-center gap-3"
            data-html2canvas-ignore="true"
          >
            <span className="text-sm font-medium text-slate-600">Periodo:</span>
            <input
              type="month"
              value={mesActual}
              onChange={(e) => setMesActual(e.target.value)}
              className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mr-2"
            />
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={datosRegiones.length === 0 || isExportingPDF}
              className="h-10 border-slate-200 text-slate-700 hover:text-rose-700 hover:bg-rose-50"
            >
              <Printer className="w-4 h-4 mr-2 text-rose-600" /> Exportar PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
          </div>
        ) : datosRegiones.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 mt-6">
            <Globe className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-700">
              Sin operaciones
            </h2>
            <p className="text-slate-500 mt-2">
              No se registraron retiros para este mes.
            </p>
          </div>
        ) : (
          <>
            {/* TARJETAS DE MÉTRICAS */}
            {metricasGlobales && (
              <div
                className={cn(
                  "grid gap-4",
                  isExportingPDF
                    ? "grid-cols-4"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
                )}
              >
                <Card className="border-l-4 border-l-blue-500 shadow-sm bg-white">
                  <CardContent className="p-6">
                    <div className="flex justify-between text-slate-500 mb-2">
                      <span className="text-sm font-medium">
                        SLA Promedio Global
                      </span>
                      <Target className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-3xl font-black text-slate-800">
                      {metricasGlobales.slaGlobal}%
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      De {metricasGlobales.volumenTotal.toLocaleString()}{" "}
                      operaciones
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500 shadow-sm bg-white">
                  <CardContent className="p-6">
                    <div className="flex justify-between text-slate-500 mb-2">
                      <span className="text-sm font-medium">
                        Tiempo Medio Global
                      </span>
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-3xl font-black text-slate-800">
                      {metricasGlobales.tiempoGlobal}{" "}
                      <span className="text-base text-slate-500 font-normal">
                        min
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between text-emerald-700 mb-2">
                      <span className="text-sm font-medium">
                        Región Más Sana
                      </span>
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-800">
                      {metricasGlobales.regionFuerte.region}
                    </div>
                    <p className="text-sm font-bold text-emerald-600 mt-1">
                      {metricasGlobales.regionFuerte.sla}% SLA
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-rose-500 bg-rose-50/30 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between text-rose-700 mb-2">
                      <span className="text-sm font-medium">
                        Región en Riesgo
                      </span>
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="text-2xl font-black text-rose-800">
                      {metricasGlobales.regionRiesgo.region}
                    </div>
                    <p className="text-sm font-bold text-rose-600 mt-1">
                      {metricasGlobales.regionRiesgo.sla}% SLA (
                      {metricasGlobales.regionRiesgo.tiempoPromedio} min)
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div
              className={cn(
                "grid gap-6",
                isExportingPDF ? "grid-cols-3" : "grid-cols-1 lg:grid-cols-3",
              )}
            >
              {/* GRÁFICA PRINCIPAL */}
              <Card className="lg:col-span-2 shadow-sm border-slate-200 bg-white">
                <CardHeader className="border-b bg-slate-50/50">
                  <CardTitle className="text-lg text-slate-800">
                    Cumplimiento SLA vs Volumen por Región
                  </CardTitle>
                  <CardDescription>
                    Rendimiento del área distribuido por mercado operativo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[350px] w-full flex items-center justify-center">
                    {isExportingPDF ? (
                      <BarChart
                        width={750}
                        height={350}
                        data={datosRegiones}
                        margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="region"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 12,
                            fontWeight: "bold",
                            fill: "#475569",
                          }}
                          dy={10}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          domain={[0, 100]}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                        />

                        <Bar
                          yAxisId="left"
                          dataKey="sla"
                          name="SLA Cumplido (%)"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        >
                          {datosRegiones.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.sla >= 90
                                  ? "#10b981"
                                  : entry.sla >= 75
                                    ? "#f59e0b"
                                    : "#ef4444"
                              }
                            />
                          ))}
                        </Bar>
                        <Bar
                          yAxisId="right"
                          dataKey="volumen"
                          name="Volumen de Retiros"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                          opacity={0.3}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={datosRegiones}
                          margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="region"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 12,
                              fontWeight: "bold",
                              fill: "#475569",
                            }}
                            dy={10}
                          />
                          <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            domain={[0, 100]}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                          />
                          <RechartsTooltip
                            cursor={{ fill: "#f1f5f9" }}
                            contentStyle={{
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                          />

                          <Bar
                            yAxisId="left"
                            dataKey="sla"
                            name="SLA Cumplido (%)"
                            radius={[4, 4, 0, 0]}
                          >
                            {datosRegiones.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.sla >= 90
                                    ? "#10b981"
                                    : entry.sla >= 75
                                      ? "#f59e0b"
                                      : "#ef4444"
                                }
                              />
                            ))}
                          </Bar>
                          <Bar
                            yAxisId="right"
                            dataKey="volumen"
                            name="Volumen de Retiros"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            opacity={0.3}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* TABLA DE DESGLOSE */}
              <Card className="shadow-sm border-slate-200 overflow-hidden flex flex-col bg-white">
                <CardHeader className="border-b bg-slate-50/50">
                  <CardTitle className="text-lg text-slate-800">
                    Desglose Operativo
                  </CardTitle>
                  <CardDescription>
                    Detalle de impacto por mercado.
                  </CardDescription>
                </CardHeader>
                <div
                  className={cn(
                    "flex-1",
                    isExportingPDF ? "overflow-visible" : "overflow-auto",
                  )}
                >
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-white border-b sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Región</th>
                        <th className="px-4 py-3 text-center">Vol.</th>
                        <th className="px-4 py-3 text-center">SLA</th>
                        <th className="px-4 py-3 text-right">Tiempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosRegiones.map((divisa, i) => (
                        <tr
                          key={i}
                          className="border-b hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {divisa.region}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {divisa.volumen}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={cn(
                                "px-2 py-1 rounded text-xs font-bold",
                                divisa.sla >= 90
                                  ? "bg-emerald-100 text-emerald-700"
                                  : divisa.sla >= 75
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700",
                              )}
                            >
                              {divisa.sla}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-600">
                            {divisa.tiempoPromedio}m
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
