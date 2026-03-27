// src/app/reporte-diario/page.tsx
"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import * as xlsx from "xlsx";
import { useCurrency } from "../context/CurrencyContext";

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
  CalendarDays,
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

interface OperacionRow {
  id: string;
  hora: string;
  jugador: number;
  cantidad: number;
  tiempo: number;
  cumple: boolean;
  operador: string;
  nivel: string;
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
  const [rawOps, setRawOps] = useState<OperacionRow[]>([]);

  // Filtros y Paginación Doble
  const [selectedOperator, setSelectedOperator] = useState<string>("Todos");
  const [operadoresList, setOperadoresList] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [currentWorstPage, setCurrentWorstPage] = useState(1); // NUEVO: Paginación para Brechas Críticas
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchDailyData = async () => {
      if (!selectedDate || !currency) return;
      setIsLoading(true);

      try {
        const fechaDB = `${selectedDate}T00:00:00.000Z`;

        const q = query(
          collection(db, "operaciones_retiros"),
          where("Fecha del reporte", "==", fechaDB),
          where("Moneda", "==", currency),
        );

        const snapshot = await getDocs(q);
        const ops: OperacionRow[] = [];
        const opsSet = new Set<string>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          const dateStr = String(data["Fecha de la operación"]);
          const timePart = dateStr.includes(" ")
            ? dateStr.split(" ")[1]
            : "00:00:00";
          const operador = data.Operador || "Desconocido";

          opsSet.add(operador);

          ops.push({
            id: doc.id,
            hora: timePart,
            jugador: data.Jugador,
            cantidad: Number(data.Cantidad) || 0,
            tiempo: Number(data.Tiempo) || 0,
            cumple: data.Cumple === true,
            operador: operador,
            nivel: data.Nivel || "Estándar",
          });
        });

        ops.sort((a, b) => a.hora.localeCompare(b.hora));

        setRawOps(ops);
        setOperadoresList(Array.from(opsSet).sort());

        // Reseteo de estados al cambiar de día
        setSelectedOperator("Todos");
        setCurrentPage(1);
        setCurrentWorstPage(1);
      } catch (error) {
        console.error("Error cargando reporte diario:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, [selectedDate, currency]);

  const processedData = useMemo(() => {
    const filteredOps =
      selectedOperator === "Todos"
        ? rawOps
        : rawOps.filter((op) => op.operador === selectedOperator);

    // 1. Cálculos de Automatización (Global)
    const totalGlobal = rawOps.length;
    const autoCount = rawOps.filter((op) => op.operador === "Autopago").length;
    const autoPct =
      totalGlobal > 0 ? ((autoCount / totalGlobal) * 100).toFixed(1) : "0.0";

    // 2. Cálculos Manuales (SLA y Tiempo)
    const manualOps = filteredOps.filter((op) => op.operador !== "Autopago");
    const totalManual = manualOps.length;
    let manualSlaCount = 0;
    let manualTotalTime = 0;

    manualOps.forEach((op) => {
      manualTotalTime += op.tiempo;
      if (op.cumple) manualSlaCount++;
    });

    const metrics = {
      totalTx: filteredOps.length,
      slaPct:
        totalManual > 0
          ? ((manualSlaCount / totalManual) * 100).toFixed(1)
          : "0.0",
      avgTime:
        totalManual > 0 ? (manualTotalTime / totalManual).toFixed(1) : "0.0",
      autoPct,
    };

    // 3. Cálculos Visuales
    const hourMap: Record<string, number> = {};
    const agtPerfMap: Record<string, { cumple: number; noCumple: number }> = {};

    for (let i = 7; i <= 23; i++) {
      hourMap[i.toString().padStart(2, "0") + ":00"] = 0;
    }

    filteredOps.forEach((op) => {
      const hour = op.hora.split(":")[0] + ":00";
      if (hourMap[hour] !== undefined) hourMap[hour]++;

      if (!agtPerfMap[op.operador])
        agtPerfMap[op.operador] = { cumple: 0, noCumple: 0 };
      if (op.cumple) agtPerfMap[op.operador].cumple++;
      else agtPerfMap[op.operador].noCumple++;
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

    // 4. Paginación Tabla Principal
    const totalPages = Math.ceil(filteredOps.length / itemsPerPage);
    const paginatedOps = filteredOps.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );

    // 5. NUEVO: Paginación Tabla Brechas Críticas
    const allWorstOps = filteredOps
      .filter((op) => !op.cumple)
      .sort((a, b) => b.tiempo - a.tiempo); // Traemos TODAS las que rompieron SLA

    const totalWorstPages = Math.ceil(allWorstOps.length / itemsPerPage);
    const paginatedWorstOps = allWorstOps.slice(
      (currentWorstPage - 1) * itemsPerPage,
      currentWorstPage * itemsPerPage,
    );

    return {
      filteredOps,
      metrics,
      hourlyData,
      agentChartData,
      totalPages,
      paginatedOps,
      totalWorstPages,
      paginatedWorstOps,
      allWorstOpsLength: allWorstOps.length,
    };
  }, [rawOps, selectedOperator, currentPage, currentWorstPage]);

  const handleExportExcel = () => {
    const dataToExport = processedData.filteredOps.map((op) => ({
      Hora: op.hora,
      "Jugador ID": op.jugador,
      "Nivel VIP": op.nivel,
      Monto: op.cantidad,
      "Tiempo (min)": op.tiempo,
      "Estado SLA": op.cumple ? "Cumplió (<30m)" : "Incumplió (>30m)",
      Operador: op.operador,
    }));

    const ws = xlsx.utils.json_to_sheet(dataToExport);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Retiros");
    xlsx.writeFile(
      wb,
      `Reporte_${selectedDate}_${currency}_${selectedOperator}.xlsx`,
    );
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const fechaFormateada = selectedDate
    ? format(parseISO(selectedDate), "dd 'de' MMMM, yyyy", { locale: es })
    : "";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-2 text-slate-500 hover:text-slate-800 -ml-4 print:hidden"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Gestor
      </Button>

      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm print:border-none print:shadow-none print:p-0">
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

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Filter className="w-4 h-4 text-slate-500" />
            {/* Al cambiar filtro de agente, reseteamos ambas paginaciones a la hoja 1 */}
            <Select
              value={selectedOperator}
              onValueChange={(val) => {
                setSelectedOperator(val);
                setCurrentPage(1);
                setCurrentWorstPage(1);
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
            <Download className="w-4 h-4 mr-2 text-emerald-600" /> Exportar XLSX
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintPDF}
            disabled={rawOps.length === 0}
            className="h-10 border-slate-200 text-slate-700 hover:text-rose-700 hover:bg-rose-50"
          >
            <Printer className="w-4 h-4 mr-2 text-rose-600" /> Exportar PDF
          </Button>
        </div>
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
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
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
            <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
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
            <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
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
            <Card className="shadow-sm border-slate-200 bg-slate-50/50 print:break-inside-avoid">
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

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
            <Card className="shadow-sm border-slate-200 print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700">
                  Flujo de Trabajo (07:00 a 23:00)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
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
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 print:break-inside-avoid print:mt-6">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700">
                  Desempeño por Agente (SLA)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
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
                        wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tablas Paginadas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:space-y-6">
            {/* Tabla General */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200 print:break-inside-avoid print:mt-6 flex flex-col h-full">
              <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-700">
                  Detalle de Operaciones
                </CardTitle>
                <span className="text-sm text-slate-500 font-normal">
                  Total: {processedData.filteredOps.length}
                </span>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col justify-between">
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-white border-b">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Hora</th>
                        <th className="px-4 py-3 font-semibold">Jugador</th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Nivel
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Tiempo
                        </th>
                        <th className="px-4 py-3 font-semibold">Operador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.paginatedOps.map((op, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-600">
                            {op.hora}
                          </td>
                          <td className="px-4 py-2 font-medium text-slate-800">
                            {op.jugador}
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
                          <td className="px-4 py-2 text-slate-600">
                            {op.operador}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Paginación General */}
                {processedData.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 print:hidden mt-auto">
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

            {/* Tabla Brechas Críticas (Ahora Paginada) */}
            <Card className="shadow-sm border-rose-200 print:break-inside-avoid print:mt-6 flex flex-col h-full">
              <CardHeader className="bg-rose-50/50 border-b border-rose-100 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-rose-800 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-rose-600" />{" "}
                  Brechas Críticas
                </CardTitle>
                {/* Mostramos el total de incumplimientos */}
                {processedData.allWorstOpsLength > 0 && (
                  <span className="text-sm font-bold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200">
                    {processedData.allWorstOpsLength} fallos
                  </span>
                )}
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col justify-between">
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-white border-b">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Hora</th>
                        <th className="px-4 py-3 font-semibold">Operador</th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Mins
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.paginatedWorstOps.length > 0 ? (
                        processedData.paginatedWorstOps.map((op, i) => (
                          <tr key={i} className="border-b hover:bg-rose-50/50">
                            <td className="px-4 py-2 text-slate-600">
                              {op.hora}
                            </td>
                            <td
                              className="px-4 py-2 font-medium text-slate-800 truncate max-w-[100px]"
                              title={op.operador}
                            >
                              {op.operador}
                            </td>
                            <td className="px-4 py-2 text-center font-bold text-rose-600">
                              {op.tiempo}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-emerald-600 font-medium"
                          >
                            ¡Día perfecto! Sin incumplimientos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Paginación Brechas Críticas */}
                {processedData.totalWorstPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-rose-50 print:hidden mt-auto">
                    <span className="text-sm text-rose-600/70 font-medium">
                      Pág {currentWorstPage} de {processedData.totalWorstPages}
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
        </>
      )}
    </div>
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
