"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import {
  ETIQUETA_TURNO,
  HORAS,
  HORA_TURNO,
  TURNOS,
  describirTurnoEspecial,
  fechaCorta,
  formatoHora,
  rangoHorario,
  separarHorario,
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
import { cambioDeFondo, confirmarPendiente, type Pendiente } from "@/components/horarios/deFondo";

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

/** Desde/hasta del turno: el horario guardado o, si está vacío o no se entiende, el normal. */
const horasDe = (t: Turno, horario: string) => separarHorario(horario) ?? separarHorario(HORA_TURNO[t])!;

/** Guarda vacío cuando el rango es el normal del turno. */
const textoHorario = (t: Turno, desde: string, hasta: string) => {
  const r = rangoHorario(desde, hasta);
  return r === HORA_TURNO[t] ? "" : r;
};

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

  /** Corre el cambio de fondo; si borraría ediciones manuales de ese día, antes pide confirmación. */
  const cambiar = (
    fecha: string,
    ejecutar: (confirmar: boolean) => Promise<void>,
    textos: { cargando: string; listo: string; alFallar?: () => void },
  ) =>
    cambioDeFondo({
      ...textos,
      medir: async () => (await apiFetch<{ editadas: number }>(`/api/horarios/especiales?impacto=${fecha}`)).editadas,
      ejecutar,
      alTerminar: () => {
        cargar();
        onCambio();
      },
      pedirConfirmacion: setPendiente,
    });

  /** El formulario se cierra al instante; si falla o se cancela, vuelve a abrirse con lo escrito. */
  const guardar = () => {
    if (!form) return;
    const previo = form;
    const { datos, editando } = form;
    setForm(null);
    void cambiar(
      datos.fecha,
      async (confirmar) => {
        await apiFetch("/api/horarios/especiales", { method: "PUT", body: JSON.stringify({ ...datos, confirmar }) });
      },
      {
        cargando: editando ? "Actualizando día especial…" : "Agregando día especial…",
        listo: editando ? "Día especial actualizado" : "Día especial agregado",
        alFallar: () => setForm((f) => f ?? previo),
      },
    );
  };

  const eliminar = (d: DiaEspecial) =>
    void cambiar(
      d.fecha,
      async (confirmar) => {
        await apiFetch(`/api/horarios/especiales?fecha=${d.fecha}${confirmar ? "&confirmar=1" : ""}`, { method: "DELETE" });
      },
      { cargando: "Eliminando día especial…", listo: "Día especial eliminado" },
    );

  const set = <K extends keyof DiaEspecial>(k: K, v: DiaEspecial[K]) =>
    setForm((f) => (f ? { ...f, datos: { ...f.datos, [k]: v } } : f));
  const horarioInvalido =
    !!form &&
    TURNOS.some((t) => {
      const c = campo(t);
      const h = horasDe(t, form.datos[c.horario]);
      return form.datos[c.personas] !== 0 && h.hasta <= h.desde;
    });
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
                const { desde, hasta } = horasDe(t, form.datos[c.horario]);
                const cerrado = personas === 0;
                return (
                  <fieldset key={t} className="grid gap-2 rounded-lg border border-border p-3">
                    <legend className="px-1 text-sm font-medium">{ETIQUETA_TURNO[t]}</legend>
                    <Select value={String(personas)} onValueChange={(v) => set(c.personas, Number(v) as Personas)}>
                      <SelectTrigger className="w-full" aria-label={`Personas ${ETIQUETA_TURNO[t]}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPCIONES.map((o) => (
                          <SelectItem key={o.valor} value={String(o.valor)}>{o.texto}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-3">
                      {(["desde", "hasta"] as const).map((lado) => (
                        <div key={lado} className="grid min-w-0 gap-1.5">
                          <Label className="text-xs text-muted-foreground">{lado === "desde" ? "Desde" : "Hasta"}</Label>
                          <Select
                            disabled={cerrado}
                            value={lado === "desde" ? desde : hasta}
                            onValueChange={(v) =>
                              set(c.horario, textoHorario(t, lado === "desde" ? v : desde, lado === "hasta" ? v : hasta))
                            }
                          >
                            <SelectTrigger className="w-full" aria-label={`${lado === "desde" ? "Desde" : "Hasta"} ${ETIQUETA_TURNO[t]}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {HORAS.map((h) => (
                                <SelectItem key={h} value={h}>{formatoHora(h)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    {!cerrado && hasta <= desde && (
                      <p className="text-xs text-danger-text">La hora de fin debe ser posterior a la de inicio.</p>
                    )}
                  </fieldset>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={!form?.datos.fecha || horarioInvalido}>Guardar</Button>
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
          if (borrando) eliminar(borrando);
          setBorrando(null);
        }}
      />

      <ConfirmDialog
        {...confirmarPendiente(pendiente, () => setPendiente(null))}
        titulo="Se perderán ediciones manuales"
        descripcion={`El horario se rehace desde ese día y se pierden ${pendiente?.editadas ?? 0} casillas que editaste a mano. ¿Continuar?`}
        accion="Continuar"
        tono="warning"
      />
    </div>
  );
}
