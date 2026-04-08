// src/app/reporte-diario/page.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Play,
  CloudDownload,
  Database,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useCurrency } from "@/app/context/CurrencyContext";
import { useAuth } from "@/app/context/AuthContext";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

type FileStatus = "idle" | "uploading" | "success" | "duplicate" | "error";

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  message?: string;
}

export default function CargarArchivosPage() {
  const { currency } = useCurrency();
  const { userData } = useAuth();

  // Estados para Carga de Excel
  const [archivos, setArchivos] = React.useState<QueuedFile[]>([]);
  const [isProcessingExcel, setIsProcessingExcel] = React.useState(false);

  // Estados para Sincronización API
  const [apiDate, setApiDate] = React.useState<Date | undefined>(new Date());
  const [isFetchingApi, setIsFetchingApi] = React.useState(false);

  React.useEffect(() => {
    setArchivos([]);
  }, [currency]);

  // --- LÓGICA DEL API ---
  const handleExtraerAPI = async () => {
    if (!apiDate) return toast.warning("Selecciona una fecha");

    const dateStr = format(apiDate, "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (dateStr === todayStr) {
      return toast.warning("No puedes cargar los retiros del día en curso.");
    }

    setIsFetchingApi(true);

    const formData = new FormData();
    formData.append("currency", currency);
    formData.append("subidoPor", userData?.nombre || "Usuario Desconocido");
    formData.append("rol", userData?.rol || "");
    formData.append("fecha", dateStr);

    try {
      const response = await fetch("/api/fetch-api-reporte", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();

      if (json.success) {
        toast.success("Completado", { description: json.message });
      } else {
        toast.error("Error", {
          description: json.error || "Fallo al conectar con el API",
        });
      }
    } catch (error) {
      toast.error("Error de red crítico al ejecutar la petición");
    } finally {
      setIsFetchingApi(false);
    }
  };

  // --- LÓGICA DE EXCEL ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls"),
    );
    if (selectedFiles.length !== validFiles.length)
      toast.warning("Archivos ignorados, solo Excel.");
    const newQueued = validFiles.map((f) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: "idle" as FileStatus,
    }));
    setArchivos((prev) => [...prev, ...newQueued]);
    e.target.value = "";
  };

  const removeFile = (idToRemove: string) =>
    setArchivos((prev) => prev.filter((f) => f.id !== idToRemove));

  const procesarTodos = async () => {
    const pendientes = archivos.filter(
      (a) => a.status === "idle" || a.status === "error",
    );
    if (pendientes.length === 0)
      return toast.info("No hay archivos pendientes por procesar.");
    setIsProcessingExcel(true);

    for (const item of pendientes) {
      setArchivos((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: "uploading" } : a)),
      );
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("currency", currency);
      formData.append("subidoPor", userData?.nombre || "Usuario Desconocido");
      formData.append("rol", userData?.rol || "");

      try {
        const response = await fetch("/api/upload-reporte", {
          method: "POST",
          body: formData,
        });
        const json = await response.json();
        if (json.success) {
          setArchivos((prev) =>
            prev.map((a) =>
              a.id === item.id
                ? { ...a, status: "success", message: json.message }
                : a,
            ),
          );
        } else {
          const finalStatus = json.code === "DUPLICATE" ? "duplicate" : "error";
          setArchivos((prev) =>
            prev.map((a) =>
              a.id === item.id
                ? { ...a, status: finalStatus, message: json.error }
                : a,
            ),
          );
        }
      } catch (error) {
        setArchivos((prev) =>
          prev.map((a) =>
            a.id === item.id
              ? { ...a, status: "error", message: "Error de red" }
              : a,
          ),
        );
      }
    }
    setIsProcessingExcel(false);
    toast.success("Cola finalizada");
  };

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "idle":
        return <FileSpreadsheet className="w-5 h-5 text-slate-400" />;
      case "uploading":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "duplicate":
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
    }
  };

  // Variable para determinar si el día seleccionado es HOY
  const isTodaySelected = apiDate
    ? format(apiDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
    : false;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">
          Ingreso de Reportes Operativos
        </h1>
        <p className="text-slate-500 mt-1">
          Sincroniza los retiros para la moneda activa:{" "}
          <strong className="text-primary">{currency}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* CARD AZUL: API */}
        <Card className="shadow-lg border-t-4 border-t-blue-500">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center text-blue-900">
                  <Database className="w-5 h-5 mr-2 text-blue-600" />
                  Sincronización API
                </CardTitle>
                <CardDescription className="mt-1">
                  Extrae directamente desde Calimaco sin necesidad de Excel.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Fecha a consultar
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal border-slate-300",
                      !apiDate && "text-slate-500",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {apiDate ? (
                      format(apiDate, "PPP", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={apiDate}
                    onSelect={setApiDate}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {isTodaySelected && (
                <p className="text-xs text-amber-600 font-medium">
                  * No se puede consultar el día de hoy porque aún está en
                  curso.
                </p>
              )}
            </div>

            <Button
              onClick={handleExtraerAPI}
              disabled={isFetchingApi || isTodaySelected || !apiDate}
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base shadow-md disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isFetchingApi ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CloudDownload className="w-5 h-5 mr-2" />
              )}
              {isFetchingApi ? "Consultando proveedor..." : "Cargar retiros"}
            </Button>
          </CardContent>
        </Card>

        {/* CARD VERDE: EXCEL */}
        <Card className="shadow-lg border-t-4 border-t-emerald-500">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center text-emerald-900">
                  <FileSpreadsheet className="w-5 h-5 mr-2 text-emerald-600" />
                  Carga de Respaldo
                </CardTitle>
                <CardDescription className="mt-1">
                  Sube archivos Excel (.xlsx) en caso de fallo del API.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="dropzone-file"
                className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer bg-emerald-50/30 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-6 h-6 mb-2 text-emerald-500" />
                  <p className="mb-1 text-sm text-slate-600">
                    <span className="font-semibold text-emerald-700">
                      Haz clic
                    </span>{" "}
                    o arrastra tus Excel
                  </p>
                </div>
                <Input
                  id="dropzone-file"
                  type="file"
                  className="hidden"
                  multiple
                  accept=".xlsx, .xls"
                  onChange={handleFileSelect}
                  disabled={isProcessingExcel}
                />
              </label>
            </div>

            {archivos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-emerald-800 border-b border-emerald-100 pb-2">
                  Archivos en cola
                </h3>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  {archivos.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded shadow-sm"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {getStatusIcon(item.status)}
                        <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">
                          {item.file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status !== "uploading" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(item.id)}
                            disabled={isProcessingExcel}
                            className="h-6 w-6 text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={procesarTodos}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isProcessingExcel || archivos.length === 0}
                >
                  {isProcessingExcel ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Procesar Archivos Manuales
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
