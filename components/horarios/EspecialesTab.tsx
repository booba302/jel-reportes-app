"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import {
  ETIQUETA_TURNO,
  HORA_TURNO,
  TURNOS,
  describirTurnoEspecial,
  fechaCorta,
  type DiaEspecial,
  type Personas,
  type Turno,
} from "@/lib/horario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cardClass } from "@/components/dashboard/CardHeading";
import { ConfirmDialog } from "@/components/usuarios/ConfirmDialog";
import { CampoFecha } from "@/components/horarios/CampoFecha";

const VACIO: DiaEspecial = {
  fecha: "",
  personasManana: 1,
  personasTarde: 1,
  horarioManana: "",
  horarioTarde: "",
  nota: "",
};

const OPCIONES: { valor: Personas; texto: string }[] = [
  { valor: 2, texto: "2 personas (normal)" },
  { valor: 1, texto: "1 persona, todas las monedas" },
  { valor: 0, texto: "Cerrado" },
];

const campo = (t: Turno) =>
  t === "manana"
    ? ({ personas: "personasManana", horario: "horarioManana" } as const)
    : ({ personas: "personasTarde", horario: "horarioTarde" } as const);

type Pendiente = { editadas: number; ejecutar: () => Promise<void> };

/** Días con turnos reducidos. Si el día ya está generado, el horario se rehace desde ese día. */
export function EspecialesTab({ onCambio }: { onCambio: () => void }) {
  const [lista, setLista] = useState<DiaEspecial[] | null>(null);
  const [form, setForm] = useState<{ editando: boolean; datos: DiaEspecial } | null>(null);
  const [borrando, setBorrando] = useState<DiaEspecial | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let cancelado = false;
    apiFetch<{ especiales: DiaEspecial[] }>("/api/horarios/especiales")
      .then((r) => !cancelado && setLista(r.especiales))
      .catch((err) => !cancelado && toast.error(err instanceof Error ? err.message : "No se pudieron cargar los días especiales."));
    return () => {
      cancelado = true;
    };
  }, [version]);

  /** Si se perderían ediciones manuales de ese día, pide confirmación antes de ejecutar. */
  const conImpacto = async (fecha: string, ejecutar: (confirmar: boolean) => Promise<void>) => {
    const { editadas } = await apiFetch<{ editadas: number }>(`/api/horarios/especiales?impacto=${fecha}`);
    const terminar = async (confirmar: boolean) => {
      await ejecutar(confirmar);
      cargar();
      onCambio();
    };
    if (editadas > 0) setPendiente({ editadas, ejecutar: () => terminar(true) });
    else await terminar(false);
  };

  const guardar = async () => {
    if (!form) return;
    const { datos, editando } = form;
    try {
      await conImpacto(datos.fecha, async (confirmar) => {
        await apiFetch("/api/horarios/especiales", { method: "PUT", body: JSON.stringify({ ...datos, confirmar }) });
        toast.success(editando ? "Día especial actualizado" : "Día especial agregado");
        setForm(null);
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  };

  const eliminar = async (d: DiaEspecial) => {
    try {
      await conImpacto(d.fecha, async (confirmar) => {
        await apiFetch(`/api/horarios/especiales?fecha=${d.fecha}${confirmar ? "&confirmar=1" : ""}`, { method: "DELETE" });
        toast.success("Día especial eliminado");
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
      throw err;
    }
  };

  const set = <K extends keyof DiaEspecial>(k: K, v: DiaEspecial[K]) =>
    setForm((f) => (f ? { ...f, datos: { ...f.datos, [k]: v } } : f));
  const yaExiste = !form?.editando && !!lista?.some((d) => d.fecha === form?.datos.fecha);

  return (
    <div className={cn(cardClass, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Días especiales</h2>
          <p className="text-xs text-muted-foreground">
            Turnos con menos personas u otro horario (Navidad, 31 de diciembre…). Nadie se salta: la rotación sigue en orden.
          </p>
        </div>
        <Button size="sm" onClick={() => setForm({ editando: false, datos: VACIO })}>
          <Plus className="size-4" /> Nuevo día especial
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3">Nota</th>
              <th className="py-2 pr-3">Mañana</th>
              <th className="py-2 pr-3">Tarde</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {lista?.map((d) => (
              <tr key={d.fecha} className="border-t border-border">
                <td className="py-2 pr-3">{fechaCorta(d.fecha)}/{d.fecha.slice(0, 4)}</td>
                <td className="py-2 pr-3">{d.nota}</td>
                <td className="py-2 pr-3">{describirTurnoEspecial(d, "manana")}</td>
                <td className="py-2 pr-3">{describirTurnoEspecial(d, "tarde")}</td>
                <td className="py-2 text-right">
                  <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ editando: true, datos: { ...d } })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => setBorrando(d)}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {lista?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  No hay días especiales cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.editando ? "Editar día especial" : "Nuevo día especial"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="esp-fecha">Fecha</Label>
                  <CampoFecha
                    id="esp-fecha"
                    valor={form.datos.fecha}
                    onCambio={(f) => set("fecha", f)}
                    disabled={form.editando}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="esp-nota">Nota</Label>
                  <Input
                    id="esp-nota"
                    maxLength={100}
                    placeholder="Navidad"
                    value={form.datos.nota}
                    onChange={(e) => set("nota", e.target.value)}
                  />
                </div>
              </div>
              {yaExiste && (
                <p className="text-xs text-warning-text">Esa fecha ya es un día especial: al guardar se reemplaza.</p>
              )}
              {TURNOS.map((t) => {
                const c = campo(t);
                const personas = form.datos[c.personas];
                return (
                  <div key={t} className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{ETIQUETA_TURNO[t]}</Label>
                      <Select value={String(personas)} onValueChange={(v) => set(c.personas, Number(v) as Personas)}>
                        <SelectTrigger aria-label={`Personas ${ETIQUETA_TURNO[t]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPCIONES.map((o) => (
                            <SelectItem key={o.valor} value={String(o.valor)}>{o.texto}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`esp-horario-${t}`}>Horario (opcional)</Label>
                      <Input
                        id={`esp-horario-${t}`}
                        maxLength={40}
                        disabled={personas === 0}
                        placeholder={HORA_TURNO[t]}
                        value={personas === 0 ? "" : form.datos[c.horario]}
                        onChange={(e) => set(c.horario, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={!form?.datos.fecha}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!borrando}
        onOpenChange={(o) => !o && setBorrando(null)}
        titulo="Eliminar día especial"
        descripcion={borrando ? `El ${fechaCorta(borrando.fecha)} vuelve a ser un día normal y, si ya está generado, el horario se rehace desde ese día.` : ""}
        accion="Eliminar"
        tono="danger"
        onConfirmar={async () => {
          if (borrando) await eliminar(borrando);
          setBorrando(null);
        }}
      />

      <ConfirmDialog
        open={!!pendiente}
        onOpenChange={(o) => !o && setPendiente(null)}
        titulo="Se perderán ediciones manuales"
        descripcion={`El horario se rehace desde ese día y se pierden ${pendiente?.editadas ?? 0} casillas que editaste a mano. ¿Continuar?`}
        accion="Continuar"
        tono="warning"
        onConfirmar={async () => {
          try {
            await pendiente?.ejecutar();
            setPendiente(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
            throw err;
          }
        }}
      />
    </div>
  );
}
