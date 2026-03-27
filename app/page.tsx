// src/app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrency } from "./context/CurrencyContext";
import {
  Activity,
  Clock,
  CheckCircle2,
  Bot,
  DollarSign,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  CalendarRange,
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Tipos
interface Metrics {
  totalTx: number;
  totalAmount: number;
  slaPct: number;
  avgTime: number;
  autoPct: number;
}
interface PeriodComparison {
  current: Metrics;
  trend: {
    totalTx: number;
    totalAmount: number;
    slaPct: number;
    avgTime: number;
    autoPct: number;
  };
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];

export default function DashboardPage() {
  const { currency } = useCurrency();
  const [dateFilter, setDateFilter] = useState("current_month");
  const [isLoading, setIsLoading] = useState(true);

  const [metrics, setMetrics] = useState<PeriodComparison | null>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [levelData, setLevelData] = useState<any[]>([]);
  const [agentData, setAgentData] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currency) return;
      setIsLoading(true);

      try {
        // 1. Lógica de Fechas
        const now = new Date();
        let currStart = new Date(0),
          currEnd = new Date(),
          prevStart = new Date(0),
          prevEnd = new Date(0);
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        if (dateFilter === "current_month") {
          // Mes actual (Ej: Marzo) comparado con el anterior (Ej: Febrero)
          currStart = new Date(currentYear, currentMonth, 1);
          currEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 1, 1);
          prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        } else if (dateFilter === "last_month") {
          // Mes anterior (Ej: Febrero) comparado con el tras anterior (Ej: Enero)
          currStart = new Date(currentYear, currentMonth - 1, 1);
          currEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 2, 1);
          prevEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59);
        } else if (dateFilter === "last_3_months") {
          // Últimos 3 meses comparados con los 3 anteriores a esos
          currStart = new Date(currentYear, currentMonth - 2, 1);
          currEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
          prevStart = new Date(currentYear, currentMonth - 5, 1);
          prevEnd = new Date(currentYear, currentMonth - 2, 0, 23, 59, 59);
        }

        // 2. Consulta a Firebase (Si es GLOBAL, traemos todo; si no, filtramos por moneda)
        let q;
        if ((currency as string) === "GLOBAL") {
          q = query(collection(db, "operaciones_retiros"));
        } else {
          q = query(
            collection(db, "operaciones_retiros"),
            where("Moneda", "==", currency),
          );
        }

        const snapshot = await getDocs(q);

        // Estructuras para cálculos
        const currentData: any[] = [];
        const prevData: any[] = [];
        const dayMap: Record<string, { total: number; sla: number }> = {};
        const lvlMap: Record<string, number> = {};
        const agtMap: Record<string, { total: number; sla: number }> = {};

        // 3. Procesamiento en Memoria
        snapshot.forEach((doc) => {
          const data = doc.data();
          const opDate = new Date(data["Fecha de la operación"]);

          // Clasificamos si cae en el período actual o el anterior
          if (
            dateFilter === "all_time" ||
            (opDate >= currStart && opDate <= currEnd)
          ) {
            currentData.push(data);

            // Agrupaciones visuales solo para el período actual
            const cumple = data.Cumple === true;
            const operador = data.Operador || "Desconocido";
            const nivel = data.Nivel || "Estándar";
            const dateOnly = String(data["Fecha de la operación"])
              .split(" ")[0]
              .replace(/\//g, "-");

            if (!dayMap[dateOnly]) dayMap[dateOnly] = { total: 0, sla: 0 };
            dayMap[dateOnly].total++;
            if (cumple) dayMap[dateOnly].sla++;

            if (!lvlMap[nivel]) lvlMap[nivel] = 0;
            lvlMap[nivel]++;

            if (operador !== "Autopago") {
              if (!agtMap[operador]) agtMap[operador] = { total: 0, sla: 0 };
              agtMap[operador].total++;
              if (cumple) agtMap[operador].sla++;
            }
          } else if (opDate >= prevStart && opDate <= prevEnd) {
            prevData.push(data);
          }
        });

        // 4. Funciones de Cálculo de Métricas Ponderadas
        const calcMetrics = (dataset: any[]): Metrics => {
          let tx = 0,
            amount = 0,
            slaCount = 0,
            time = 0,
            autoCount = 0;
          dataset.forEach((d) => {
            tx++;
            amount += Number(d.Cantidad) || 0;
            time += Number(d.Tiempo) || 0;
            if (d.Cumple) slaCount++;
            if (d.Operador === "Autopago") autoCount++;
          });
          return {
            totalTx: tx,
            totalAmount: amount,
            slaPct: tx > 0 ? (slaCount / tx) * 100 : 0,
            avgTime: tx > 0 ? time / tx : 0,
            autoPct: tx > 0 ? (autoCount / tx) * 100 : 0,
          };
        };

        const curr = calcMetrics(currentData);
        const prev = calcMetrics(prevData);

        // 5. Cálculo de Tendencias (Porcentajes de cambio)
        const calcTrend = (c: number, p: number) => {
          if (p === 0) return c > 0 ? 100 : 0;
          return ((c - p) / p) * 100;
        };

        setMetrics({
          current: curr,
          trend: {
            totalTx: calcTrend(curr.totalTx, prev.totalTx),
            totalAmount: calcTrend(curr.totalAmount, prev.totalAmount),
            slaPct: curr.slaPct - prev.slaPct, // Puntos porcentuales directos
            avgTime: calcTrend(curr.avgTime, prev.avgTime),
            autoPct: curr.autoPct - prev.autoPct,
          },
        });

        // 6. Formateo para Gráficos (igual que antes)
        setDailyData(
          Object.keys(dayMap)
            .sort()
            .map((date) => ({
              fecha: date.substring(5),
              volumen: dayMap[date].total,
              slaPct: Math.round((dayMap[date].sla / dayMap[date].total) * 100),
            })),
        );
        setLevelData(
          Object.keys(lvlMap)
            .map((lvl) => ({ name: lvl, value: lvlMap[lvl] }))
            .sort((a, b) => b.value - a.value),
        );
        setAgentData(
          Object.keys(agtMap)
            .map((agt) => ({
              nombre: agt,
              total: agtMap[agt].total,
              slaPct: ((agtMap[agt].sla / agtMap[agt].total) * 100).toFixed(1),
            }))
            .sort((a, b) => b.total - a.total),
        );
      } catch (error) {
        console.error("Error cargando métricas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [currency, dateFilter]); // Se recalcula si cambia la moneda o el filtro de fecha

  // Formateadores
  const formatMoney = (amount: number, currencyCode: string) => {
    const code = currencyCode === "GLOBAL" ? "USD" : currencyCode; // Asumimos USD base si es Global
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Renderizador de píldora de tendencia
  const renderTrend = (
    value: number,
    reverseColors = false,
    isPoints = false,
  ) => {
    if (dateFilter === "all_time") return null; // No hay comparación en histórico

    const isPositive = value > 0.1;
    const isNegative = value < -0.1;
    const color = isPositive
      ? reverseColors
        ? "text-rose-600"
        : "text-emerald-600"
      : isNegative
        ? reverseColors
          ? "text-emerald-600"
          : "text-rose-600"
        : "text-slate-500";
    const bgColor = isPositive
      ? reverseColors
        ? "bg-rose-50"
        : "bg-emerald-50"
      : isNegative
        ? reverseColors
          ? "bg-emerald-50"
          : "bg-rose-50"
        : "bg-slate-100";
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
    const sign = isPositive ? "+" : "";

    return (
      <div
        className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color} ${bgColor}`}
      >
        <Icon className="w-3 h-3 mr-1" />
        {sign}
        {value.toFixed(1)}
        {isPoints ? " pts" : "%"}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Cabecera con Filtro de Fechas */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />{" "}
            {(currency as string) === "GLOBAL"
              ? "Visión Global (Todas las Monedas)"
              : "Visión de Rendimiento"}
          </h1>
          <p className="text-slate-500 mt-1">
            Análisis operativo para{" "}
            <strong className="text-primary">{currency}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <CalendarRange className="w-4 h-4 text-slate-500" />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] h-9 bg-white border-slate-300 text-sm font-medium">
              <SelectValue placeholder="Rango de tiempo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mes Actual</SelectItem>
              <SelectItem value="last_month">Mes Anterior</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 Meses</SelectItem>
              <SelectItem value="all_time">Histórico Completo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-xl border shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="ml-3 text-slate-500 font-medium">
            Procesando cubos de datos...
          </span>
        </div>
      ) : !metrics || metrics.current.totalTx === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <DollarSign className="w-10 h-10 text-slate-400 mb-2" />
          <p className="text-slate-500 font-medium">
            No hay datos procesados para el rango seleccionado.
          </p>
        </div>
      ) : (
        <>
          {/* NIVEL 1: KPIs con Tendencias */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  SLA de Cumplimiento
                </CardTitle>
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-slate-800">
                    {metrics.current.slaPct.toFixed(1)}%
                  </div>
                  {renderTrend(metrics.trend.slaPct, false, true)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Retiros bajo 30 minutos
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Tiempo Promedio
                </CardTitle>
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-slate-800">
                    {metrics.current.avgTime.toFixed(1)}{" "}
                    <span className="text-lg font-medium text-slate-500">
                      min
                    </span>
                  </div>
                  {/* reverseColors = true porque un aumento en tiempo es malo (Rojo) */}
                  {renderTrend(metrics.trend.avgTime, true)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Tiempo general de resolución
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Volumen Procesado
                </CardTitle>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div
                    className="text-2xl font-bold text-slate-800 truncate"
                    title={formatMoney(metrics.current.totalAmount, currency)}
                  >
                    {(currency as string) === "GLOBAL"
                      ? "Múltiple"
                      : formatMoney(metrics.current.totalAmount, currency)}
                  </div>
                  {renderTrend(metrics.trend.totalTx)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {metrics.current.totalTx.toLocaleString("es-CL")}{" "}
                  transacciones en total
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Automatización
                </CardTitle>
                <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-violet-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-slate-800">
                    {metrics.current.autoPct.toFixed(1)}%
                  </div>
                  {renderTrend(metrics.trend.autoPct, false, true)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Resuelto por Autopago
                </p>
              </CardContent>
            </Card>
          </div>

          {/* NIVEL 2: GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-200">
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700">
                  Evolución de Volumen Diario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dailyData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorVol"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                      />
                      <XAxis
                        dataKey="fecha"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: any) => [
                          `${value} retiros`,
                          "Volumen",
                        ]}
                        labelFormatter={(label) => `Día: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="volumen"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorVol)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700">
                  Distribución por Nivel VIP
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={levelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {levelData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [
                          `${value} retiros`,
                          "Cantidad",
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: "12px", color: "#64748b" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* NIVEL 3: RANKING DE AGENTES */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="text-base font-semibold text-slate-700 flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary" /> Rendimiento del
                Equipo (Gestión Manual)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-4 font-semibold">
                        Agente Operador
                      </th>
                      <th className="px-6 py-4 font-semibold text-center">
                        Retiros Procesados
                      </th>
                      <th className="px-6 py-4 font-semibold text-center">
                        SLA Cumplido (&lt; 30 min)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentData.length > 0 ? (
                      agentData.map((agente, index) => (
                        <tr
                          key={index}
                          className="bg-white border-b hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {agente.nombre}
                          </td>
                          <td className="px-6 py-4 text-center font-semibold text-slate-600">
                            {agente.total}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                Number(agente.slaPct) >= 90
                                  ? "bg-emerald-100 text-emerald-700"
                                  : Number(agente.slaPct) >= 75
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {agente.slaPct}%
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-8 text-center text-slate-500"
                        >
                          No hay registros de agentes para esta selección.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
