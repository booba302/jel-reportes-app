// src/app/(dashboard)/cierre-mensual/page.tsx
"use client";

import { useState, useEffect } from "react";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as xlsx from "xlsx";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Trophy,
  AlertCircle,
  CheckCircle2,
  Lock,
  Loader2,
  CalendarDays,
  TrendingUp,
  Target,
  Download,
  Printer,
  Award,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function CierreMensualPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lee el mes de la URL si existe (útil para cuando le des a "Volver al ranking" desde el expediente)
  const mesQuery = searchParams.get("mes");
  const [mesActual, setMesActual] = useState<string>(
    mesQuery || format(new Date(), "yyyy-MM"),
  );

  // Para controlar el año dentro del nuevo selector de Shadcn
  const [pickerYear, setPickerYear] = useState(
    parseInt(format(new Date(), "yyyy")),
  );
  const mesesNombres = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [mesCerrado, setMesCerrado] = useState(false);
  const [mesYaTermino, setMesYaTermino] = useState(false);

  // Datos procesados Globales
  const [rawEvalsGuardados, setRawEvalsGuardados] = useState<any[]>([]);
  const [reportesMensuales, setReportesMensuales] = useState<any[]>([]);
  const [metricasGlobales, setMetricasGlobales] = useState<any>(null);
  const [estadoAuditoria, setEstadoAuditoria] = useState<any>(null);

  // --- ESTADOS PARA PDF ---
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportingType, setExportingType] = useState<
    "GLOBAL" | "DETALLE" | null
  >(null);

  // --- MOTOR DEFINITIVO ANTI-RECORTE ---
  const handleExportPDF = (tipo: "GLOBAL" | "DETALLE") => {
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

    // Identificamos qué vista capturar y su nombre de archivo
    const elementId = "cierre-mensual-global";
    const nombreArchivo = `Cierre_Mensual_${mesActual}.pdf`;

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
            // Ignoramos todo lo que tenga esta etiqueta
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
        console.error("Error generando PDF:", error);
        toast.error("Hubo un problema al exportar el documento.");
      } finally {
        if (viewportMeta)
          viewportMeta.setAttribute("content", originalViewport);
        setIsExportingPDF(false);
        setExportingType(null);
      }
    }, 800);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      setMesYaTermino(mesActual < currentMonthStr);

      const start = `${mesActual}-01T00:00:00.000Z`;
      const end = `${mesActual}-31T23:59:59.999Z`;

      // 🔴 LISTA DE EXCLUSIÓN
      const JEFES_EXCLUIDOS = ["Franklin Sánchez", "Marvin"];

      const q = query(
        collection(db, "evaluaciones_desempeno"),
        where("fecha", ">=", start),
        where("fecha", "<=", end),
      );
      const snapshot = await getDocs(q);
      const diarias: any[] = [];

      // 🔴 FILTRO 1: Ocultar evaluaciones diarias de los jefes
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!JEFES_EXCLUIDOS.includes(data.operador)) {
          diarias.push(data);
        }
      });
      setRawEvalsGuardados(diarias);

      const docCierreRef = doc(db, "evaluaciones_mensuales", mesActual);
      const docCierreSnap = await getDoc(docCierreRef);

      if (docCierreSnap.exists()) {
        const data = docCierreSnap.data();
        setMesCerrado(true);

        // 🔴 FILTRO 2: Si el mes ya estaba cerrado en el pasado, limpiamos a los jefes del ranking visual
        const rankingLimpio = (data.ranking || []).filter(
          (r: any) => !JEFES_EXCLUIDOS.includes(r.operador),
        );

        setReportesMensuales(rankingLimpio);
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
  }, [mesActual]);

  const handleCerrarMes = async () => {
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

  // RENDER: VISTA NORMAL (Cierre Mensual General)
  return (
    <div
      id="cierre-mensual-global"
      className={cn(
        "p-6 mx-auto space-y-8 animate-in fade-in duration-500 print:p-0 print:max-w-full print:bg-white",
        // FIX 1: Aquí es donde debe ir la magia de los 1200px, en el div principal que se fotografía
        isExportingPDF && exportingType === "GLOBAL"
          ? "absolute top-0 left-0 w-[1200px] min-w-[1200px] bg-[#f8fafc] z-[9998] shadow-none"
          : "max-w-7xl",
      )}
    >
      {/* FIX 2: La pantalla de carga debe ser un simple 'fixed inset-0', la tenías mezclada con los 1200px */}
      {isExportingPDF && (
        <div
          data-html2canvas-ignore="true"
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center"
        >
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Generando PDF</h2>
            <p className="text-slate-500 mt-2 text-center max-w-[250px]">
              Ajustando pantalla y tablas para evitar recortes...
            </p>
          </div>
        </div>
      )}
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

        <div
          className="flex flex-wrap items-center gap-3"
          data-html2canvas-ignore="true"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 print:hidden">
              Periodo:
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[180px] justify-start text-left font-normal bg-white print:border-none print:shadow-none print:p-0 print:text-xl print:font-bold"
                >
                  <CalendarDays className="mr-2 h-4 w-4 print:hidden" />
                  {format(
                    new Date(
                      parseInt(mesActual.split("-")[0]),
                      parseInt(mesActual.split("-")[1]) - 1,
                      1,
                    ),
                    "MMMM yyyy",
                    { locale: es },
                  ).replace(/^\w/, (c) => c.toUpperCase())}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPickerYear((y) => y - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="font-bold text-slate-800">{pickerYear}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPickerYear((y) => y + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {mesesNombres.map((mes, idx) => {
                    const val = `${pickerYear}-${String(idx + 1).padStart(2, "0")}`;
                    return (
                      <Button
                        key={mes}
                        variant={mesActual === val ? "default" : "ghost"}
                        className="h-9"
                        onClick={() => setMesActual(val)}
                      >
                        {mes}
                      </Button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
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
                onClick={() => handleExportPDF("GLOBAL")}
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
                {/* NUEVO BOTÓN CON ALERT DIALOG DE SHADCN */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={
                        estadoAuditoria.pendientes > 0 ||
                        !mesYaTermino ||
                        isClosing
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
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl">
                        ¿Cerrar el mes de{" "}
                        {format(
                          new Date(
                            parseInt(mesActual.split("-")[0]),
                            parseInt(mesActual.split("-")[1]) - 1,
                            1,
                          ),
                          "MMMM",
                          { locale: es },
                        ).replace(/^\w/, (c) => c.toUpperCase())}
                        ?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-base text-slate-600">
                        Esta acción consolidará los promedios definitivos de
                        todos los operadores en la base de datos. <br />
                        <br />
                        <strong className="text-rose-600">
                          ⚠️ Esta acción no se puede deshacer.
                        </strong>{" "}
                        ¿Estás absolutamente seguro de continuar?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCerrarMes}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Sí, cerrar mes
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                  {/* FIX 3: Quitamos el overflow-x-auto cuando exportamos a PDF para que no corte el lado derecho */}
                  <div
                    className={cn(
                      "print:overflow-visible print:w-full print:max-w-full",
                      isExportingPDF && exportingType === "GLOBAL"
                        ? "overflow-visible w-full"
                        : "overflow-x-auto",
                    )}
                  >
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
                              onClick={() =>
                                router.push(
                                  `/expediente/${encodeURIComponent(rep.operador)}?mes=${mesActual}`,
                                )
                              }
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
