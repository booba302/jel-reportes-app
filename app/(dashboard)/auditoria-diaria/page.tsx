// src/app/reporte-diario/page.tsx
"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import * as xlsx from "xlsx";
import { useCurrency } from "@/app/context/CurrencyContext";
import { cn } from "@/lib/utils";

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

import {
  ArrowLeft,
  Activity,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Users,
  AlertTriangle,
  Loader2,
  Download,
  Printer,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MessageSquare,
  Zap,
  X,
  Save,
  FileText,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

interface OperacionRow {
  id: string;
  hora: string;
  alias: string;
  cantidad: number;
  tiempo: number;
  cumple: boolean;
  operador: string;
  nivel: string;
  comentarioBrecha?: string;
}

function ReporteDiarioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currency } = useCurrency();

  const fechaParam = searchParams.get("fecha");

  const [selectedDate, setSelectedDate] = useState<string>(
    fechaParam ? fechaParam.split("T")[0] : format(new Date(), "yyyy-MM-dd"),
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [rawOps, setRawOps] = useState<OperacionRow[]>([]);

  const [selectedOperator, setSelectedOperator] = useState<string>("Todos");
  const [operadoresList, setOperadoresList] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [currentWorstPage, setCurrentWorstPage] = useState(1);
  const [currentFastPage, setCurrentFastPage] = useState(1);
  const itemsPerPage = 10;

  // Estados para los buscadores independientes
  const [searchOps, setSearchOps] = useState("");
  const [searchWorst, setSearchWorst] = useState("");

  // Estados para el Modal de Comentarios de Brecha
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [selectedOpId, setSelectedOpId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);

  // 🔴 Estados para la Observación General del Día
  const [dailyObservation, setDailyObservation] = useState("");
  const [isSavingObservation, setIsSavingObservation] = useState(false);

  useEffect(() => {
    const fetchDailyData = async () => {
      if (!selectedDate || !currency) return;
      setIsLoading(true);

      try {
        const fechaDB = `${selectedDate}T00:00:00.000Z`;

        // 1. Cargar las operaciones
        const q = query(
          collection(db, "operaciones_retiros"),
          where("Fecha del reporte", "==", fechaDB),
          where("Moneda", "==", currency),
        );
        const snapshot = await getDocs(q);
        const ops: OperacionRow[] = [];
        const opsSet = new Set<string>();

        snapshot.forEach((document) => {
          const data = document.data();
          const dateStr = String(data["Fecha de la operación"]);
          const timePart = dateStr.includes(" ")
            ? dateStr.split(" ")[1]
            : "00:00:00";
          const operador = data.Operador || "Desconocido";

          opsSet.add(operador);

          ops.push({
            id: document.id,
            hora: timePart,
            alias: data.Alias,
            cantidad: Number(data.Cantidad) || 0,
            tiempo: Number(data.Tiempo) || 0,
            cumple: data.Cumple === true,
            operador: operador,
            nivel: data.Nivel || "Estándar",
            comentarioBrecha: data.comentarioBrecha || "",
          });
        });

        ops.sort((a, b) => a.hora.localeCompare(b.hora));

        setRawOps(ops);
        setOperadoresList(Array.from(opsSet).sort());

        setSelectedOperator("Todos");
        setCurrentPage(1);
        setCurrentWorstPage(1);
        setCurrentFastPage(1);

        // 🔴 2. Cargar la observación general del día
        const obsRef = doc(
          db,
          "observaciones_diarias",
          `${currency}_${selectedDate}`,
        );
        const obsSnap = await getDoc(obsRef);
        if (obsSnap.exists()) {
          setDailyObservation(obsSnap.data().observacion || "");
        } else {
          setDailyObservation("");
        }
      } catch (error) {
        console.error("Error cargando reporte diario:", error);
        toast.error("Error al cargar la información");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, [selectedDate, currency]);

  const handleSaveComment = async () => {
    if (!selectedOpId) return;
    setIsSavingComment(true);
    try {
      await updateDoc(doc(db, "operaciones_retiros", selectedOpId), {
        comentarioBrecha: commentText,
      });

      setRawOps((prev) =>
        prev.map((op) =>
          op.id === selectedOpId
            ? { ...op, comentarioBrecha: commentText }
            : op,
        ),
      );

      toast.success("Comentario guardado exitosamente");
      setCommentModalOpen(false);
    } catch (error) {
      console.error("Error al guardar comentario:", error);
      toast.error("Hubo un problema al guardar el comentario");
    } finally {
      setIsSavingComment(false);
    }
  };

  // 🔴 FUNCIÓN PARA GUARDAR LA OBSERVACIÓN DEL DÍA
  const handleSaveObservation = async () => {
    setIsSavingObservation(true);
    try {
      await setDoc(
        doc(db, "observaciones_diarias", `${currency}_${selectedDate}`),
        {
          observacion: dailyObservation,
          fechaActualizacion: new Date().toISOString(),
        },
        { merge: true },
      );
      toast.success("Observación del día guardada");
    } catch (error) {
      console.error("Error al guardar la observación:", error);
      toast.error("Hubo un problema al guardar la observación");
    } finally {
      setIsSavingObservation(false);
    }
  };

  const processedData = useMemo(() => {
    const filteredOps =
      selectedOperator === "Todos"
        ? rawOps
        : rawOps.filter((op) => op.operador === selectedOperator);

    const totalGlobal = rawOps.length;
    const autoCount = rawOps.filter((op) => op.operador === "Autopago").length;
    const autoPct =
      totalGlobal > 0 ? ((autoCount / totalGlobal) * 100).toFixed(1) : "0.0";

    const manualOps = filteredOps.filter((op) => op.operador !== "Autopago");

    // 🔴 NUEVO: Filtramos solo las operaciones evaluables (sin comentario de exoneración)
    const evaluableOps = manualOps.filter(
      (op) => !op.comentarioBrecha || op.comentarioBrecha.trim() === "",
    );

    const totalEvaluable = evaluableOps.length;
    let manualSlaCount = 0;
    let manualTotalTime = 0;

    // 🔴 NUEVO: El cálculo de SLA y Tiempo Promedio ahora usa SOLO las operaciones evaluables
    evaluableOps.forEach((op) => {
      manualTotalTime += op.tiempo;
      if (op.cumple) manualSlaCount++;
    });

    const metrics = {
      totalTx: filteredOps.length, // Seguimos mostrando el volumen real total
      slaPct:
        totalEvaluable > 0
          ? ((manualSlaCount / totalEvaluable) * 100).toFixed(1)
          : "0.0",
      avgTime:
        totalEvaluable > 0
          ? (manualTotalTime / totalEvaluable).toFixed(1)
          : "0.0",
      autoPct,
    };

    const hourMap: Record<string, number> = {};
    const agtPerfMap: Record<string, { cumple: number; noCumple: number }> = {};

    for (let i = 7; i <= 23; i++) {
      hourMap[i.toString().padStart(2, "0") + ":00"] = 0;
    }

    filteredOps.forEach((op) => {
      // Flujo de trabajo por hora (Aquí dejamos todos, porque es volumen de trabajo)
      const hour = op.hora.split(":")[0] + ":00";
      if (hourMap[hour] !== undefined) hourMap[hour]++;

      // 🔴 NUEVO: Gráfica de Agentes. Solo castigamos si NO hay justificación
      if (op.operador !== "Autopago") {
        if (!agtPerfMap[op.operador])
          agtPerfMap[op.operador] = { cumple: 0, noCumple: 0 };

        const isExonerated =
          op.comentarioBrecha && op.comentarioBrecha.trim() !== "";

        if (!isExonerated) {
          if (op.cumple) agtPerfMap[op.operador].cumple++;
          else agtPerfMap[op.operador].noCumple++;
        }
      }
    });

    const hourlyData = Object.keys(hourMap)
      .sort()
      .map((h) => ({
        hora: h,
        volumen: hourMap[h],
      }));

    const agentChartData = Object.keys(agtPerfMap).map((agt) => ({
      nombre: agt,
      Cumplen: agtPerfMap[agt].cumple,
      Incumplen: agtPerfMap[agt].noCumple,
    }));

    // ... (El cálculo de metrics, hourlyData y agentChartData sigue exactamente igual)

    // 🔴 1. BUSCADOR LOCAL: Detalle de Operaciones
    const searchOpsLower = searchOps.toLowerCase();
    const opsToPaginate =
      searchOps.trim() === ""
        ? filteredOps
        : filteredOps.filter(
            (op) =>
              op.alias.toLowerCase().includes(searchOpsLower) ||
              op.operador.toLowerCase().includes(searchOpsLower) ||
              op.hora.includes(searchOpsLower),
          );

    const totalPages = Math.ceil(opsToPaginate.length / itemsPerPage);
    const paginatedOps = opsToPaginate.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );

    // 🔴 2. BUSCADOR LOCAL: Brechas Críticas
    const allWorstOps = filteredOps
      .filter((op) => !op.cumple)
      .sort((a, b) => b.tiempo - a.tiempo);

    const searchWorstLower = searchWorst.toLowerCase();
    const worstToPaginate =
      searchWorst.trim() === ""
        ? allWorstOps
        : allWorstOps.filter(
            (op) =>
              op.alias.toLowerCase().includes(searchWorstLower) ||
              op.operador.toLowerCase().includes(searchWorstLower) ||
              op.hora.includes(searchWorstLower),
          );

    const totalWorstPages = Math.ceil(worstToPaginate.length / itemsPerPage);
    const paginatedWorstOps = worstToPaginate.slice(
      (currentWorstPage - 1) * itemsPerPage,
      currentWorstPage * itemsPerPage,
    );

    // (superFastOps se queda igual)
    const superFastOps = filteredOps
      .filter((op) => op.tiempo < 1 && op.operador !== "Autopago")
      .sort((a, b) => a.tiempo - b.tiempo);

    const totalFastPages = Math.ceil(superFastOps.length / itemsPerPage);
    const paginatedFastOps = superFastOps.slice(
      (currentFastPage - 1) * itemsPerPage,
      currentFastPage * itemsPerPage,
    );

    return {
      filteredOps,
      opsListLength: opsToPaginate.length, // <-- Exportamos el total filtrado para el contador
      metrics,
      hourlyData,
      agentChartData,
      totalPages,
      paginatedOps,
      totalWorstPages,
      paginatedWorstOps,
      allWorstOpsLength: worstToPaginate.length, // <-- Exportamos el total filtrado para el contador
      superFastOps,
      totalFastPages,
      paginatedFastOps,
    };
  }, [
    rawOps,
    selectedOperator,
    currentPage,
    currentWorstPage,
    currentFastPage,
    searchOps,
    searchWorst,
  ]);

  const handleExportExcel = () => {
    const dataToExport = processedData.filteredOps.map((op) => ({
      Hora: op.hora,
      Jugador: op.alias,
      "Nivel VIP": op.nivel,
      Monto: op.cantidad,
      "Tiempo (min)": op.tiempo,
      "Estado SLA": op.cumple ? "Cumplió (<30m)" : "Incumplió (>30m)",
      Operador: op.operador,
      Comentario: op.comentarioBrecha || "N/A",
    }));

    const ws = xlsx.utils.json_to_sheet(dataToExport);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Retiros");

    if (processedData.superFastOps.length > 0) {
      const fastDataExport = processedData.superFastOps.map((op) => ({
        Hora: op.hora,
        Jugador: op.alias,
        "Nivel VIP": op.nivel,
        Monto: op.cantidad,
        "Tiempo (min)": op.tiempo,
        Operador: op.operador,
      }));
      const wsFast = xlsx.utils.json_to_sheet(fastDataExport);
      xlsx.utils.book_append_sheet(wb, wsFast, "Flash (<1 min)");
    }

    xlsx.writeFile(
      wb,
      `Reporte_${selectedDate}_${currency}_${selectedOperator}.xlsx`,
    );
  };

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    toast.info("Ajustando dimensiones...", {
      description: "Preparando captura en ultra-ancha.",
    });

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute("content") || "";
    if (viewportMeta) {
      viewportMeta.setAttribute("content", "width=1200, initial-scale=1");
    }

    setTimeout(async () => {
      const element = document.getElementById("reporte-gerencial");
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
          style: {
            width: "1200px",
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

        const opName =
          selectedOperator !== "Todos"
            ? `_${selectedOperator.replace(/\s+/g, "_")}`
            : "";
        pdf.save(`Auditoria_Diaria_${selectedDate}_${currency}${opName}.pdf`);

        toast.success("PDF exportado exitosamente");
      } catch (error) {
        console.error("Error generando PDF:", error);
        toast.error("Hubo un problema al exportar el documento.");
      } finally {
        if (viewportMeta) {
          viewportMeta.setAttribute("content", originalViewport);
        }
        setIsExportingPDF(false);
      }
    }, 800);
  };

  const fechaFormateada = selectedDate
    ? format(parseISO(selectedDate), "dd 'de' MMMM, yyyy", { locale: es })
    : "";

  return (
    <>
      {commentModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2 text-primary" />
                Comentario de Brecha
              </h3>
              <button
                onClick={() => setCommentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-3">
                Explica brevemente por qué este retiro tuvo demora (falla de
                API, validación de cuenta, etc).
              </p>
              <textarea
                className="w-full h-32 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none text-sm text-slate-700"
                placeholder="Motivo de la demora..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="mt-5 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setCommentModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveComment} disabled={isSavingComment}>
                  {isSavingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isExportingPDF && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <Loader2 className="w-12 h-12 animate-spin text-rose-600 mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Generando PDF</h2>
            <p className="text-slate-500 mt-2 text-center max-w-[250px]">
              Ajustando pantalla para evitar recortes...
            </p>
          </div>
        </div>
      )}

      <div
        id="reporte-gerencial"
        className={cn(
          "p-6 space-y-6 min-h-screen",
          isExportingPDF
            ? "absolute top-0 left-0 w-[1200px] min-w-[1200px] bg-[#f8fafc] z-[9998] shadow-none"
            : "max-w-7xl mx-auto bg-slate-50 transition-all duration-300",
        )}
      >
        {!isExportingPDF && (
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-2 text-slate-500 hover:text-slate-800 -ml-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Gestor
          </Button>
        )}

        <div
          className={cn(
            "flex gap-4 bg-white p-5 rounded-xl border shadow-sm",
            isExportingPDF
              ? "flex-row justify-between items-end"
              : "flex-col md:flex-row justify-between md:items-end",
          )}
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Auditoría Diaria
            </h1>
            <p className="text-slate-600 mt-1 text-lg">
              Reporte del{" "}
              <strong className="text-primary capitalize">
                {fechaFormateada}
              </strong>{" "}
              en <strong className="text-primary">{currency}</strong>.
            </p>
          </div>

          {!isExportingPDF && (
            <div className="flex flex-wrap items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[220px] justify-start text-left font-normal bg-white",
                      !selectedDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(parseISO(selectedDate), "PPP", { locale: es })
                    ) : (
                      <span>Selecciona fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={parseISO(selectedDate)}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(format(date, "yyyy-MM-dd"));
                        setCurrentFastPage(1);
                      }
                    }}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Filter className="w-4 h-4 text-slate-500" />
                <Select
                  value={selectedOperator}
                  onValueChange={(val) => {
                    setSelectedOperator(val);
                    setCurrentPage(1);
                    setCurrentWorstPage(1);
                    setCurrentFastPage(1);
                  }}
                  disabled={rawOps.length === 0}
                >
                  <SelectTrigger className="w-[180px] h-8 bg-transparent border-none focus:ring-0 text-sm font-medium">
                    <SelectValue placeholder="Filtrar operador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos los operadores</SelectItem>
                    {operadoresList.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={rawOps.length === 0}
                className="h-10 border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="w-4 h-4 mr-2 text-emerald-600" /> XLSX
              </Button>

              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={rawOps.length === 0 || isExportingPDF}
                className="h-10 border-slate-200 text-slate-700 hover:text-rose-700 hover:bg-rose-50 min-w-[100px]"
              >
                <Printer className="w-4 h-4 mr-2 text-rose-600" /> PDF
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center min-h-[40vh]">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : rawOps.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 mt-6">
            <AlertOctagon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-700">Sin datos</h2>
            <p className="text-slate-500 mt-2">
              No hay operaciones registradas para el {fechaFormateada} en la
              moneda {currency}.
            </p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "grid gap-4",
                isExportingPDF ? "grid-cols-4" : "grid-cols-2 md:grid-cols-4",
              )}
            >
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      Total Retiros
                    </p>
                    <Activity className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-2">
                    {processedData.metrics.totalTx}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      SLA del Día
                    </p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-2">
                    {processedData.metrics.slaPct}%
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      Tiempo Promedio
                    </p>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-2">
                    {processedData.metrics.avgTime}{" "}
                    <span className="text-base text-slate-500 font-normal">
                      min
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      Automáticos
                    </p>
                    <Users className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-2">
                    {processedData.metrics.autoPct}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div
              className={cn(
                "grid gap-6",
                isExportingPDF ? "grid-cols-2" : "grid-cols-1 lg:grid-cols-2",
              )}
            >
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-700">
                    Flujo de Trabajo (07:00 a 23:00)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full flex items-center justify-center">
                    {isExportingPDF ? (
                      <AreaChart
                        width={500}
                        height={250}
                        data={processedData.hourlyData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="hora"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          dy={10}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="volumen"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          fillOpacity={0.2}
                          fill="#3b82f6"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={processedData.hourlyData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="hora"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            dy={10}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                          />
                          <RechartsTooltip
                            formatter={(value: any) => [
                              `${value} retiros`,
                              "Volumen",
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="volumen"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={0.2}
                            fill="#3b82f6"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-700">
                    Desempeño por Agente (SLA)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full flex items-center justify-center">
                    {isExportingPDF ? (
                      <BarChart
                        width={500}
                        height={250}
                        data={processedData.agentChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="nombre"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: "12px",
                            paddingTop: "10px",
                          }}
                        />
                        <Bar
                          dataKey="Cumplen"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="Incumplen"
                          fill="#ef4444"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={processedData.agentChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="nombre"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                          />
                          <RechartsTooltip cursor={{ fill: "#f1f5f9" }} />
                          <Legend
                            wrapperStyle={{
                              fontSize: "12px",
                              paddingTop: "10px",
                            }}
                          />
                          <Bar
                            dataKey="Cumplen"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="Incumplen"
                            fill="#ef4444"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div
              className={cn(
                "grid gap-6",
                isExportingPDF ? "grid-cols-2" : "grid-cols-1 lg:grid-cols-2",
              )}
            >
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold text-slate-700">
                      Detalle de Operaciones
                    </CardTitle>
                    <span className="text-sm text-slate-500 font-normal bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      Total: {processedData.opsListLength}
                    </span>
                  </div>

                  {!isExportingPDF && (
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar jugador..."
                        value={searchOps}
                        onChange={(e) => {
                          setSearchOps(e.target.value);
                          setCurrentPage(1); // Regresa a pág 1 al buscar
                        }}
                        className="pl-8 pr-3 h-8 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none w-full sm:w-[200px] bg-white transition-all"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col justify-between">
                  <div
                    className={cn(
                      isExportingPDF
                        ? "overflow-visible w-full"
                        : "overflow-x-auto",
                    )}
                  >
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-white border-b">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-[15%]">
                            Hora
                          </th>
                          <th className="px-4 py-3 font-semibold w-[25%]">
                            Usuario
                          </th>
                          <th className="px-4 py-3 font-semibold text-center w-[20%]">
                            Nivel
                          </th>
                          <th className="px-4 py-3 font-semibold text-center w-[20%]">
                            Tiempo
                          </th>
                          <th className="px-4 py-3 font-semibold w-[20%]">
                            Operador
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.paginatedOps.map((op, i) => (
                          <tr
                            key={i}
                            className="border-b hover:bg-slate-50/50 h-13"
                          >
                            <td className="px-4 py-2 text-slate-600">
                              {op.hora}
                            </td>
                            <td className="px-4 py-2 font-medium text-slate-800">
                              {op.alias}
                            </td>
                            <td className="px-4 py-2 text-center text-slate-500">
                              {op.nivel}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${op.cumple ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                              >
                                {op.tiempo} min
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-600 truncate max-w-[120px]">
                              {op.operador}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!isExportingPDF && processedData.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 mt-auto">
                      <span className="text-sm text-slate-500">
                        Página {currentPage} de {processedData.totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(processedData.totalPages, p + 1),
                            )
                          }
                          disabled={currentPage === processedData.totalPages}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="bg-rose-50/50 border-b border-rose-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold text-rose-800 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2 text-rose-600" />{" "}
                      Brechas Críticas
                    </CardTitle>
                    {processedData.allWorstOpsLength > 0 && (
                      <span className="text-sm font-bold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200">
                        {processedData.allWorstOpsLength} fallos
                      </span>
                    )}
                  </div>

                  {!isExportingPDF && (
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 w-4 h-4 text-rose-400" />
                      <input
                        type="text"
                        placeholder="Buscar jugador..."
                        value={searchWorst}
                        onChange={(e) => {
                          setSearchWorst(e.target.value);
                          setCurrentWorstPage(1); // Regresa a pág 1 al buscar
                        }}
                        className="pl-8 pr-3 h-8 border border-rose-200 rounded-md text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none w-full sm:w-[180px] bg-white placeholder:text-rose-300 transition-all"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col justify-between">
                  <div
                    className={cn(
                      isExportingPDF
                        ? "overflow-visible w-full"
                        : "overflow-x-auto",
                    )}
                  >
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-white border-b">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Hora</th>
                          <th className="px-4 py-3 font-semibold">Usuario</th>
                          <th className="px-4 py-3 font-semibold">Operador</th>
                          <th className="px-4 py-3 font-semibold text-center">
                            Mins
                          </th>
                          <th className="px-4 py-3 font-semibold text-center">
                            Obs
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.paginatedWorstOps.length > 0 ? (
                          processedData.paginatedWorstOps.map((op, i) => (
                            <tr
                              key={i}
                              className="border-b hover:bg-rose-50/50 h-13"
                            >
                              <td className="px-4 py-2 text-slate-600">
                                {op.hora}
                              </td>
                              <td className="px-4 py-2 text-slate-600">
                                {op.alias}
                              </td>
                              <td
                                className="px-4 py-2 font-medium text-slate-800 truncate max-w-[100px]"
                                title={op.operador}
                              >
                                {op.operador}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <div
                                  className={cn(
                                    "font-bold text-rose-600",
                                    op.comentarioBrecha &&
                                      "text-slate-400 line-through opacity-70",
                                  )}
                                >
                                  {op.tiempo}
                                </div>
                                {/* 🔴 Etiqueta de Exonerado si hay comentario */}
                                {op.comentarioBrecha && (
                                  <span className="block text-[10px] text-emerald-600 font-semibold leading-tight bg-emerald-50 rounded-full px-1.5 py-0.5 mt-0.5 w-max mx-auto border border-emerald-200">
                                    Exonerado
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOpId(op.id);
                                    setCommentText(op.comentarioBrecha || "");
                                    setCommentModalOpen(true);
                                  }}
                                  className={cn(
                                    "h-8 w-8 p-0 rounded-full",
                                    op.comentarioBrecha
                                      ? "text-primary bg-primary/10"
                                      : "text-slate-400 hover:text-primary",
                                  )}
                                  title={
                                    op.comentarioBrecha || "Agregar comentario"
                                  }
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-8 text-center text-emerald-600 font-medium"
                            >
                              ¡Día perfecto! Sin incumplimientos.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!isExportingPDF && processedData.totalWorstPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-rose-50 mt-auto">
                      <span className="text-sm text-rose-600/70 font-medium">
                        Pág {currentWorstPage} de{" "}
                        {processedData.totalWorstPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-200 text-rose-600 hover:bg-rose-100"
                          onClick={() =>
                            setCurrentWorstPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentWorstPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-200 text-rose-600 hover:bg-rose-100"
                          onClick={() =>
                            setCurrentWorstPage((p) =>
                              Math.min(processedData.totalWorstPages, p + 1),
                            )
                          }
                          disabled={
                            currentWorstPage === processedData.totalWorstPages
                          }
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <Card className="shadow-sm border-emerald-200 bg-white">
                <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-emerald-800 flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-emerald-600" />
                    Retiros Flash (&lt; 1 min)
                  </CardTitle>
                  {processedData.superFastOps.length > 0 && (
                    <span className="text-sm font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      {processedData.superFastOps.length} retiros
                    </span>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    className={cn(
                      isExportingPDF
                        ? "overflow-visible w-full"
                        : "overflow-x-auto",
                    )}
                  >
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-white border-b">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Hora</th>
                          <th className="px-4 py-3 font-semibold">Usuario</th>
                          <th className="px-4 py-3 font-semibold text-center">
                            Nivel
                          </th>
                          <th className="px-4 py-3 font-semibold text-center">
                            Tiempo (Min)
                          </th>
                          <th className="px-4 py-3 font-semibold">Operador</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.paginatedFastOps.length > 0 ? (
                          processedData.paginatedFastOps.map((op, i) => (
                            <tr
                              key={i}
                              className="border-b hover:bg-emerald-50/50"
                            >
                              <td className="px-4 py-3 text-slate-600">
                                {op.hora}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-800">
                                {op.alias}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-500">
                                {op.nivel}
                              </td>
                              <td className="px-4 py-3 text-center font-black text-emerald-600">
                                {op.tiempo}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700">
                                {op.operador}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-slate-500 font-medium"
                            >
                              No se registraron retiros flash (menores a 1
                              minuto) el día de hoy.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!isExportingPDF && processedData.totalFastPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-emerald-50/50 mt-auto">
                      <span className="text-sm text-emerald-700/70 font-medium">
                        Pág {currentFastPage} de {processedData.totalFastPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          onClick={() =>
                            setCurrentFastPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentFastPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          onClick={() =>
                            setCurrentFastPage((p) =>
                              Math.min(processedData.totalFastPages, p + 1),
                            )
                          }
                          disabled={
                            currentFastPage === processedData.totalFastPages
                          }
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 🔴 NUEVA CAJA DE OBSERVACIONES DEL DÍA */}
            <div className="mt-6">
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-700 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-slate-500" />
                    Observaciones del Día
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {isExportingPDF ? (
                    <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-700 min-h-[6rem] whitespace-pre-wrap">
                      {dailyObservation ||
                        "Sin observaciones registradas para este día."}
                    </div>
                  ) : (
                    <>
                      <textarea
                        className="w-full h-24 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none text-sm text-slate-700 bg-white"
                        placeholder="Escribe aquí si hubo intermitencias, ausencias, caídas del banco o algún evento relevante de la jornada operativa..."
                        value={dailyObservation}
                        onChange={(e) => setDailyObservation(e.target.value)}
                      />
                      <div className="flex justify-end mt-3">
                        <Button
                          onClick={handleSaveObservation}
                          disabled={isSavingObservation}
                          className="bg-slate-800 hover:bg-slate-900"
                        >
                          {isSavingObservation ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Guardar Observación
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function ReporteDiarioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }
    >
      <ReporteDiarioContent />
    </Suspense>
  );
}
