// src/app/dashboard/page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useSearchParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  CheckSquare,
  Activity,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import { useCurrency } from "../context/CurrencyContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as xlsx from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Operacion {
  id: string;
  "Fecha de la operación": string;
  Jugador: number;
  Alias: string;
  Cantidad: number;
  Nivel: string;
  "Update date": string;
  Tiempo: number;
  Cumple: boolean;
  Operador?: string;
}

type SortConfig = {
  key: keyof Operacion | null;
  direction: "asc" | "desc";
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const { currency, setCurrency } = useCurrency();
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  const [datos, setDatos] = React.useState<Operacion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [filterOperador, setFilterOperador] = React.useState<string>("todos");
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "Fecha de la operación",
    direction: "asc",
  });
  const itemsPerPage = 20;

  React.useEffect(() => {
    const urlFecha = searchParams.get('fecha');
    const urlMoneda = searchParams.get('moneda');

    if (urlMoneda) {
      setCurrency(urlMoneda as any); 
    }
    if (urlFecha) {
      setDate(new Date(urlFecha));
    }
  }, [searchParams, setCurrency]);

  const fetchReporte = async () => {
    if (!date) return;
    setIsLoading(true);
    setCurrentPage(1);
    setFilterOperador("todos");

    try {
      const dateStr = date.toISOString();
      const q = query(
        collection(db, "operaciones_retiros"),
        where("Moneda", "==", currency),
        where("Fecha del reporte", "==", dateStr),
      );
      const querySnapshot = await getDocs(q);
      const operaciones: Operacion[] = [];
      querySnapshot.forEach((doc) =>
        operaciones.push({ id: doc.id, ...doc.data() } as Operacion),
      );
      setDatos(operaciones);
      if (operaciones.length === 0)
        toast.info("Sin datos", {
          description: `No hay registros para ${currency} en esta fecha.`,
        });
    } catch (error) {
      console.error("Error obteniendo documentos: ", error);
      toast.error("Error", {
        description: "Hubo un problema al cargar el reporte.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReporte();
  }, [date, currency]);

  // FIX: Si el campo Operador viene vacío (como en reportes viejos), lo forzamos a "Autopago"
  const operadoresUnicos = React.useMemo(() => {
    const names = new Set(datos.map((op) => op.Operador || "Autopago"));
    return Array.from(names).sort();
  }, [datos]);

  const filteredDatos = React.useMemo(() => {
    let result = datos;
    if (filterOperador !== "todos") {
      result = result.filter(
        (op) => (op.Operador || "Autopago") === filterOperador,
      );
    }
    return result;
  }, [datos, filterOperador]);

  const resumenOperadores = React.useMemo(() => {
    const resumen: Record<string, any> = {};
    filteredDatos.forEach((op) => {
      const nombre = op.Operador || "Autopago";
      if (!resumen[nombre]) {
        resumen[nombre] = {
          nombre,
          total: 0,
          cumple: 0,
          noCumple: 0,
          tiempoTotal: 0,
        };
      }
      resumen[nombre].total += 1;
      resumen[nombre].tiempoTotal += op.Tiempo;
      if (op.Cumple) resumen[nombre].cumple += 1;
      else resumen[nombre].noCumple += 1;
    });

    return Object.values(resumen)
      .map((r) => ({
        ...r,
        promedio: (r.tiempoTotal / r.total).toFixed(2),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDatos]);

  const handleSort = (key: keyof Operacion) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const processedData = React.useMemo(() => {
    if (!sortConfig.key) return filteredDatos;
    return [...filteredDatos].sort((a, b) => {
      let aValue = a[sortConfig.key!];
      let bValue = b[sortConfig.key!];
      
      if (sortConfig.key === "Operador") {
        aValue = aValue || "Autopago";
        bValue = bValue || "Autopago";
      }
      
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredDatos, sortConfig]);

  // --- LÓGICA DE KPIs AJUSTADA ---
  const totalOperaciones = filteredDatos.length; // El total sigue incluyendo los autopagos
  
  // Extraemos solo a los operadores humanos para no alterar el promedio de rendimiento
  const operacionesHumanas = filteredDatos.filter(d => (d.Operador || "Autopago") !== "Autopago");
  const totalHumanas = operacionesHumanas.length;

  const cumplenSLA = operacionesHumanas.filter((d) => d.Cumple).length;
  const porcentajeCumplimiento = totalHumanas > 0
      ? ((cumplenSLA / totalHumanas) * 100).toFixed(1)
      : 0;
      
  const promedioTiempo = totalHumanas > 0
      ? (operacionesHumanas.reduce((acc, curr) => acc + curr.Tiempo, 0) / totalHumanas).toFixed(2)
      : 0;
  // --- FIN LÓGICA DE KPIs ---

  const handleExportExcel = () => {
    if (processedData.length === 0)
      return toast.error("No hay datos para exportar");
    const workbook = xlsx.utils.book_new();
    const resumenGeneral = [
      { Métrica: "Fecha del Reporte", Valor: format(date!, "dd/MM/yyyy") },
      { Métrica: "Moneda", Valor: currency },
      {
        Métrica: "Filtro Aplicado",
        Valor: filterOperador !== "todos" ? filterOperador : "Todos los operadores",
      },
      { Métrica: "Total Procesados (Inc. Autopago)", Valor: totalOperaciones },
      {
        Métrica: "Cumplimiento SLA Equipo (<30m)",
        Valor: `${porcentajeCumplimiento}%`,
      },
      { Métrica: "Tiempo Promedio Equipo (min)", Valor: promedioTiempo },
    ];
    
    const wsResumen = xlsx.utils.json_to_sheet(resumenGeneral);
    if (resumenOperadores.length > 0) {
      const operadoresExport = resumenOperadores.map((op) => ({
        "Nombre del Agente": op.nombre,
        "Total Retiros": op.total,
        "Dentro de SLA": op.cumple,
        "Fuera de SLA": op.noCumple,
        "Cumplimiento (%)": `${((op.cumple / op.total) * 100).toFixed(2)}%`,
        "Tiempo Promedio (min)": op.promedio,
      }));
      xlsx.utils.sheet_add_json(wsResumen, [{ "": "" }], { skipHeader: true, origin: -1 });
      xlsx.utils.sheet_add_json(wsResumen, [{ "": "RENDIMIENTO DETALLADO" }], { skipHeader: true, origin: -1 });
      xlsx.utils.sheet_add_json(wsResumen, operadoresExport, { origin: -1 });
    }
    xlsx.utils.book_append_sheet(workbook, wsResumen, "Resumen General");
    
    const dataToExport = processedData.map((op) => ({
      "Fecha Operación": format(new Date(op["Fecha de la operación"]), "yyyy-MM-dd HH:mm:ss"),
      Operador: op.Operador || "Autopago",
      Alias: op.Alias,
      Jugador: op.Jugador,
      Nivel: op.Nivel,
      Cantidad: op.Cantidad,
      Moneda: currency,
      "Tiempo de Resolución (min)": op.Tiempo,
      "SLA Cumplido": op.Cumple ? "Sí" : "No",
    }));
    const wsDetalle = xlsx.utils.json_to_sheet(dataToExport);
    xlsx.utils.book_append_sheet(workbook, wsDetalle, "Detalle de Operaciones");
    
    const fileName = `Reporte_${currency}_${format(date!, "dd-MM-yyyy")}.xlsx`;
    xlsx.writeFile(workbook, fileName);
    toast.success("Excel gerencial exportado correctamente");
  };

  const handleExportPDF = () => {
    if (processedData.length === 0)
      return toast.error("No hay datos para exportar");
    const doc = new jsPDF("landscape");
    doc.setFontSize(16);
    doc.text(`Reporte de Rendimiento - ${currency}`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Fecha: ${format(date!, "dd/MM/yyyy")}  |  Filtro: ${filterOperador !== "todos" ? filterOperador : "Todos los operadores"}`,
      14,
      22,
    );
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(
      `Procesados: ${totalOperaciones}   |   SLA Equipo: ${porcentajeCumplimiento}%   |   Tiempo Promedio Equipo: ${promedioTiempo} min`,
      14,
      29,
    );
    let currentY = 38;
    if (resumenOperadores.length > 0) {
      doc.setFontSize(12);
      doc.text("Resumen por Operador (Incluye Autopagos)", 14, currentY);
      const summaryBody = resumenOperadores.map((op) => [
        op.nombre,
        op.total.toString(),
        op.cumple.toString(),
        op.noCumple.toString(),
        `${((op.cumple / op.total) * 100).toFixed(2)}%`,
        `${op.promedio} min`,
      ]);
      autoTable(doc, {
        startY: currentY + 3,
        head: [
          [
            "Agente",
            "Total Procesados",
            "Dentro SLA",
            "Fuera SLA",
            "Cumplimiento",
            "Tiempo Promedio",
          ],
        ],
        body: summaryBody,
        theme: "grid",
        headStyles: { fillColor: [71, 85, 105] },
        styles: { fontSize: 9 },
        margin: { bottom: 15 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }
    doc.setFontSize(12);
    doc.text("Registro Detallado", 14, currentY);
    const tableData = processedData.map((op) => [
      format(new Date(op["Fecha de la operación"]), "dd/MM HH:mm"),
      op.Operador || "Autopago",
      op.Alias,
      op.Nivel,
      `${op.Cantidad} ${currency}`,
      `${op.Tiempo} min`,
      op.Cumple ? "Sí" : "No",
    ]);
    autoTable(doc, {
      startY: currentY + 3,
      head: [["Fecha", "Operador", "Alias", "Nivel", "Monto", "Tiempo", "SLA"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9 },
    });
    doc.save(`Reporte_${currency}_${format(date!, "dd-MM-yyyy")}.pdf`);
    toast.success("PDF gerencial exportado correctamente");
  };

  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = processedData.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Cabecera Global con Exportaciones */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-4 bg-white p-5 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Panel de Rendimiento
          </h1>
          <p className="text-slate-500 mt-1">
            Métricas y reportes en {currency}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select
              value={filterOperador}
              onValueChange={(val) => {
                setFilterOperador(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por Operador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los operadores</SelectItem>
                {operadoresUnicos.map((op, idx) => (
                  <SelectItem key={idx} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[200px] justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
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
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>

            <Button
              onClick={fetchReporte}
              disabled={isLoading || !date}
              variant="secondary"
              className="w-full sm:w-auto bg-slate-100"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Actualizar"
              )}
            </Button>
          </div>

          <div className="hidden sm:block h-10 w-px bg-slate-200"></div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={processedData.length === 0}
              className="w-full sm:w-auto border-emerald-200 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={processedData.length === 0}
              className="w-full sm:w-auto border-rose-200 text-rose-700 hover:text-rose-800 hover:bg-rose-50"
            >
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen (KPIs Generales) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Procesados
            </CardTitle>
            <Activity className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOperaciones}</div>
            <p className="text-xs text-slate-500 mt-1">Incluye Autopagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Cumplimiento SLA Equipo
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {porcentajeCumplimiento}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Excluye Autopagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Tiempo Promedio Equipo
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {promedioTiempo} min
            </div>
            <p className="text-xs text-slate-500 mt-1">Excluye Autopagos</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tiempos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Tiempos de Procesamiento{" "}
            {filterOperador !== "todos" && `(${filterOperador})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
          {filteredDatos.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredDatos}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="Alias"
                  stroke="#888888"
                  tick={false}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}m`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} min`, "Tiempo"]}
                  labelFormatter={(label) => `Alias: ${label}`}
                />
                <ReferenceLine
                  y={30}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{
                    position: "top",
                    value: "SLA (30m)",
                    fill: "#ef4444",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="Tiempo"
                  radius={[4, 4, 0, 0]}
                  shape={(props: any) => {
                    const { fill, x, y, width, height, payload } = props;
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={payload.Tiempo < 30 ? "#10b981" : "#f43f5e"}
                        rx={4}
                        ry={4}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              Sin datos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen por Operador */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-lg">Rendimiento por Operador</CardTitle>
          <CardDescription>
            Métricas de eficiencia.{" "}
            {filterOperador !== "todos" && "Mostrando operador seleccionado."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-800">
                  Nombre del Agente
                </TableHead>
                <TableHead className="text-center">Total Retiros</TableHead>
                <TableHead className="text-center text-emerald-600">
                  Dentro de SLA
                </TableHead>
                <TableHead className="text-center text-rose-600">
                  Fuera de SLA
                </TableHead>
                <TableHead className="text-center">
                  Cumplimiento SLA Promedio
                </TableHead>
                <TableHead className="text-right">Tiempo Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumenOperadores.length > 0 ? (
                resumenOperadores.map((op, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{op.nombre}</TableCell>
                    <TableCell className="text-center font-semibold">
                      {op.total}
                    </TableCell>
                    <TableCell className="text-center">{op.cumple}</TableCell>
                    <TableCell className="text-center">{op.noCumple}</TableCell>
                    <TableCell className="text-center">
                      {((op.cumple / op.total) * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {op.promedio} min
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-16 text-center text-slate-500"
                  >
                    Sin operadores registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tabla Principal */}
      <Card>
        <CardHeader className="border-b bg-slate-50/30">
          <CardTitle>Registro Detallado</CardTitle>
          <CardDescription>
            Mostrando {paginatedData.length} de {processedData.length}{" "}
            operaciones.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("Operador")}
                    className="font-semibold px-2 -ml-2"
                  >
                    Operador <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("Fecha de la operación")}
                    className="font-semibold px-2 -ml-2"
                  >
                    Fecha Hora <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("Alias")}
                    className="font-semibold px-2 -ml-2"
                  >
                    Alias <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("Cantidad")}
                    className="font-semibold px-2 -ml-2 flex ml-auto"
                  >
                    Cantidad <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("Cumple")}
                    className="font-semibold px-2 -ml-2 mx-auto"
                  >
                    SLA <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right pr-6">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("Tiempo")}
                    className="font-semibold px-2 -ml-2 flex ml-auto"
                  >
                    Tiempo (min) <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="pl-6 font-medium text-slate-700">
                      {op.Operador || "Autopago"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {format(
                        new Date(op["Fecha de la operación"]),
                        "dd MMM HH:mm",
                        { locale: es },
                      )}
                    </TableCell>
                    <TableCell>{op.Alias}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {new Intl.NumberFormat("es-CL", {
                        style: "currency",
                        currency: currency,
                      }).format(op.Cantidad)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {op.Cumple ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-rose-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {op.Tiempo}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-slate-500"
                  >
                    {isLoading
                      ? "Cargando datos..."
                      : "Ningún registro encontrado."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50 rounded-b-lg">
              <div className="text-sm text-slate-500">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <DashboardContent />
    </React.Suspense>
  );
}