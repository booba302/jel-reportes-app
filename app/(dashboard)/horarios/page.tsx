"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { gestionaHorarioInternacional } from "@/lib/roles";
import {
  TIPOS_AUSENCIA,
  conflictos,
  hoyEnZona,
  sumarMeses,
  type Ausencia,
  type DiaEspecial,
  type FilaTurno,
} from "@/lib/horario";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nombreMesAnio } from "@/components/reportes/fechas";
import { CalendarioMes, PieHorario, type CasillaEditable } from "@/components/horarios/CalendarioMes";
import { EditarTurnoDialog } from "@/components/horarios/EditarTurnoDialog";
import { AusenciasTab } from "@/components/horarios/AusenciasTab";
import { EnlaceTab } from "@/components/horarios/EnlaceTab";
import { EspecialesTab } from "@/components/horarios/EspecialesTab";
import { documentoHorario } from "@/components/horarios/exportar";
import { PdfButton } from "@/components/pdf/PdfButton";
import { ExportPdfDialog } from "@/components/pdf/ExportPdfDialog";
import { ConfirmDialog } from "@/components/usuarios/ConfirmDialog";

type Pestana = "horario" | "ausencias" | "especiales" | "enlace";
type DatosMes = { turnos: FilaTurno[]; ausencias: Ausencia[]; especiales: DiaEspecial[]; puedeGenerar: boolean; puedeEliminar: boolean };

export default function HorariosPage() {
  const { userData } = useAuth();
  const esAdmin = userData?.rol === "admin";
  const puedeGestionar = gestionaHorarioInternacional(userData?.rol ?? "");
  const [hoy] = useState(() => hoyEnZona());
  const [pestana, setPestana] = useState<Pestana>("horario");
  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const [datos, setDatos] = useState<{ mes: string; d: DatosMes } | null>(null);
  const [version, setVersion] = useState(0);
  const [editando, setEditando] = useState<CasillaEditable | null>(null);
  const [generando, setGenerando] = useState(false);
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [borrandoMes, setBorrandoMes] = useState<string | null>(null);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!puedeGestionar) return;
    let cancelado = false;
    apiFetch<DatosMes>(`/api/horarios?mes=${mes}`)
      .then((d) => !cancelado && setDatos({ mes, d }))
      .catch((err) => !cancelado && toast.error(err instanceof Error ? err.message : "No se pudo cargar el horario."));
    return () => {
      cancelado = true;
    };
  }, [puedeGestionar, mes, version]);

  const d = datos?.mes === mes ? datos.d : null;
  const ausenciasMes = useMemo(
    () => (d ? d.ausencias.map((a) => ({ ...a, tipo: TIPOS_AUSENCIA[a.tipo] })) : []),
    [d],
  );
  const avisos = useMemo(() => (d ? conflictos(d.turnos, d.ausencias) : new Map<string, string>()), [d]);

  if (!puedeGestionar) {
    return (
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-3 px-4 py-20 text-center">
        <ShieldAlert className="size-12 text-danger-text" />
        <h1 className="text-xl font-semibold">Acceso denegado</h1>
        <p className="text-muted-foreground">Solo el equipo de retiros internacionales puede gestionar este horario.</p>
      </div>
    );
  }

  const generar = async () => {
    setGenerando(true);
    try {
      await apiFetch("/api/horarios", { method: "POST", body: JSON.stringify({ mes }) });
      toast.success(`${nombreMesAnio(mes)} generado`);
      recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el mes.");
    } finally {
      setGenerando(false);
    }
  };

  /** El borrado sigue de fondo: el diálogo se cierra al instante y un toast avisa al terminar. */
  const eliminar = async () => {
    const m = mes;
    setEliminando(false);
    setBorrandoMes(m);
    const id = toast.loading(`Eliminando ${nombreMesAnio(m)}…`);
    apiFetch(`/api/horarios?mes=${m}`, { method: "DELETE" })
      .then(() => toast.success(`${nombreMesAnio(m)} eliminado`, { id }))
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar el mes.", { id }))
      .finally(() => {
        setBorrandoMes(null);
        recargar();
      });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{esAdmin ? "Horarios internacional" : "Horario"}</h1>
        <ToggleGroup type="single" variant="outline" value={pestana} onValueChange={(v) => v && setPestana(v as Pestana)}>
          <ToggleGroupItem value="horario">Horario</ToggleGroupItem>
          <ToggleGroupItem value="ausencias">Ausencias</ToggleGroupItem>
          <ToggleGroupItem value="especiales">Días especiales</ToggleGroupItem>
          <ToggleGroupItem value="enlace">Enlace</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {pestana === "horario" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Mes anterior" onClick={() => setMes(sumarMeses(mes, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[150px] text-center font-medium">{nombreMesAnio(mes)}</span>
            <Button size="icon" variant="outline" aria-label="Mes siguiente" onClick={() => setMes(sumarMeses(mes, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {d?.puedeGenerar && (
                <Button onClick={generar} disabled={generando}>
                  <Sparkles className="size-4" /> Generar mes
                </Button>
              )}
              {d?.puedeEliminar && !borrandoMes && (
                <Button variant="outline" onClick={() => setEliminando(true)}>
                  <Trash2 className="size-4" /> Eliminar mes
                </Button>
              )}
              <PdfButton onClick={() => setPdfAbierto(true)} disabled={!d || d.turnos.length === 0} />
            </div>
          </div>
          {!d ? (
            <Skeleton className="h-[480px] rounded-xl" />
          ) : d.turnos.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {d.puedeGenerar ? "Este mes aún no se generó." : "Este mes no está disponible: genera antes el mes anterior."}
            </p>
          ) : (
            <>
              {avisos.size > 0 && (
                <p className="text-sm text-warning-text">Hay {avisos.size} casillas con aviso (pasa el cursor para ver el motivo).</p>
              )}
              <CalendarioMes
                mes={mes}
                turnos={d.turnos}
                especiales={d.especiales}
                conflictos={avisos}
                onEditar={setEditando}
              />
              <PieHorario ausencias={ausenciasMes} especiales={d.especiales} />
            </>
          )}
        </>
      )}
      {pestana === "ausencias" && <AusenciasTab onCambio={recargar} />}
      {pestana === "especiales" && <EspecialesTab onCambio={recargar} />}
      {pestana === "enlace" && <EnlaceTab anio={Number(hoy.slice(0, 4))} />}

      <ExportPdfDialog
        open={pdfAbierto}
        onOpenChange={setPdfAbierto}
        titulo="Exportar horario"
        doc={
          d && d.turnos.length > 0
            ? documentoHorario({
                mes,
                turnos: d.turnos,
                ausencias: ausenciasMes,
                especiales: d.especiales,
                usuario: userData?.nombre || "Usuario",
              })
            : null
        }
      />

      <ConfirmDialog
        open={eliminando}
        onOpenChange={setEliminando}
        titulo="Eliminar mes"
        descripcion={`Se borra el horario de ${nombreMesAnio(mes)}, incluidas las casillas editadas a mano. Las ausencias y los días especiales se conservan y el mes se puede volver a generar.`}
        accion="Eliminar"
        tono="danger"
        onConfirmar={eliminar}
      />

      <EditarTurnoDialog
        casilla={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={() => {
          setEditando(null);
          recargar();
        }}
      />
    </div>
  );
}
