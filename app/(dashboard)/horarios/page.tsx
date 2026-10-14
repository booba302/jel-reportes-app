"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { TIPOS_AUSENCIA, conflictos, hoyEnZona, sumarMeses, type Ausencia, type FilaTurno } from "@/lib/horario";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nombreMesAnio } from "@/components/reportes/fechas";
import { CalendarioMes, PieHorario, type Casilla } from "@/components/horarios/CalendarioMes";
import { EditarTurnoDialog } from "@/components/horarios/EditarTurnoDialog";
import { AusenciasTab } from "@/components/horarios/AusenciasTab";
import { EnlaceTab } from "@/components/horarios/EnlaceTab";

type Pestana = "horario" | "ausencias" | "enlace";
type DatosMes = { turnos: FilaTurno[]; ausencias: Ausencia[]; puedeGenerar: boolean };

export default function HorariosPage() {
  const { userData } = useAuth();
  const esAdmin = userData?.rol === "admin";
  const [hoy] = useState(() => hoyEnZona());
  const [pestana, setPestana] = useState<Pestana>("horario");
  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const [datos, setDatos] = useState<{ mes: string; d: DatosMes } | null>(null);
  const [version, setVersion] = useState(0);
  const [editando, setEditando] = useState<Casilla | null>(null);
  const [generando, setGenerando] = useState(false);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!esAdmin) return;
    let cancelado = false;
    apiFetch<DatosMes>(`/api/horarios?mes=${mes}`)
      .then((d) => !cancelado && setDatos({ mes, d }))
      .catch((err) => !cancelado && toast.error(err instanceof Error ? err.message : "No se pudo cargar el horario."));
    return () => {
      cancelado = true;
    };
  }, [esAdmin, mes, version]);

  const d = datos?.mes === mes ? datos.d : null;
  const avisos = useMemo(() => (d ? conflictos(d.turnos, d.ausencias) : new Map<string, string>()), [d]);

  if (!esAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-3 px-4 py-20 text-center">
        <ShieldAlert className="size-12 text-danger-text" />
        <h1 className="text-xl font-semibold">Acceso denegado</h1>
        <p className="text-muted-foreground">Solo un administrador puede gestionar los horarios.</p>
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

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Horarios</h1>
        <ToggleGroup type="single" variant="outline" value={pestana} onValueChange={(v) => v && setPestana(v as Pestana)}>
          <ToggleGroupItem value="horario">Horario</ToggleGroupItem>
          <ToggleGroupItem value="ausencias">Ausencias</ToggleGroupItem>
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
            {d?.puedeGenerar && (
              <Button className="ml-auto" onClick={generar} disabled={generando}>
                <Sparkles className="size-4" /> Generar mes
              </Button>
            )}
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
              <CalendarioMes mes={mes} turnos={d.turnos} conflictos={avisos} onEditar={setEditando} />
              <PieHorario ausencias={d.ausencias.map((a) => ({ ...a, tipo: TIPOS_AUSENCIA[a.tipo] }))} />
            </>
          )}
        </>
      )}
      {pestana === "ausencias" && <AusenciasTab onCambio={recargar} />}
      {pestana === "enlace" && <EnlaceTab anio={Number(hoy.slice(0, 4))} />}

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
