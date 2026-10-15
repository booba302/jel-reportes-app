"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import {
  COLABORADORES,
  TIPOS_AUSENCIA,
  enRotacion,
  fechaCorta,
  nombreCorto,
  sumarDias,
  type Ausencia,
  type DatosAusencia,
  type TipoAusencia,
} from "@/lib/horario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cardClass } from "@/components/dashboard/CardHeading";
import { ConfirmDialog } from "@/components/usuarios/ConfirmDialog";
import { parseDiaStr } from "@/components/reportes/fechas";
import { CampoFecha } from "@/components/horarios/CampoFecha";

const VACIA: DatosAusencia = { colaborador: COLABORADORES[0], tipo: "vacaciones", inicio: "", retorno: "", nota: "" };

type Pendiente = { editadas: number; ejecutar: (confirmar: boolean) => Promise<void> };

/** Alta, edición y baja de ausencias. Si el cambio borraría ediciones manuales, pide confirmación. */
export function AusenciasTab({ onCambio }: { onCambio: () => void }) {
  const [lista, setLista] = useState<Ausencia[] | null>(null);
  const [form, setForm] = useState<{ id?: string; datos: DatosAusencia } | null>(null);
  const [borrando, setBorrando] = useState<Ausencia | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let cancelado = false;
    apiFetch<{ ausencias: Ausencia[] }>("/api/horarios/ausencias")
      .then((r) => !cancelado && setLista(r.ausencias))
      .catch((err) => !cancelado && toast.error(err instanceof Error ? err.message : "No se pudieron cargar las ausencias."));
    return () => {
      cancelado = true;
    };
  }, [version]);

  /** Mide el impacto y ejecuta, o deja la acción pendiente de confirmación. */
  const conImpacto = async (
    impacto: { id?: string; ausencia?: DatosAusencia },
    ejecutar: (confirmar: boolean) => Promise<void>,
  ) => {
    const { editadas } = await apiFetch<{ editadas: number }>("/api/horarios/ausencias/impacto", {
      method: "POST",
      body: JSON.stringify(impacto),
    });
    const terminar = async (confirmar: boolean) => {
      await ejecutar(confirmar);
      cargar();
      onCambio();
    };
    if (editadas > 0) setPendiente({ editadas, ejecutar: terminar });
    else await terminar(false);
  };

  const guardar = async () => {
    if (!form) return;
    const { id, datos } = form;
    try {
      await conImpacto({ id, ausencia: datos }, async (confirmar) => {
        await apiFetch(id ? `/api/horarios/ausencias/${id}` : "/api/horarios/ausencias", {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify({ ...datos, confirmar }),
        });
        toast.success(id ? "Ausencia actualizada" : "Ausencia agregada");
        setForm(null);
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  };

  const eliminar = async (a: Ausencia) => {
    try {
      await conImpacto({ id: a.id }, async (confirmar) => {
        await apiFetch(`/api/horarios/ausencias/${a.id}${confirmar ? "?confirmar=1" : ""}`, { method: "DELETE" });
        toast.success("Ausencia eliminada");
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
      throw err;
    }
  };

  const set = <K extends keyof DatosAusencia>(k: K, v: DatosAusencia[K]) =>
    setForm((f) => (f ? { ...f, datos: { ...f.datos, [k]: v } } : f));

  return (
    <div className={cn(cardClass, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Ausencias</h2>
        <Button size="sm" onClick={() => setForm({ datos: VACIA })}>
          <Plus className="size-4" /> Nueva ausencia
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Colaborador</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Desde</th>
              <th className="py-2 pr-3">Vuelve</th>
              <th className="py-2 pr-3">Nota</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {lista?.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="py-2 pr-3">
                  {nombreCorto(a.colaborador)}
                  {!enRotacion(a.colaborador) && <span className="ml-1 text-xs text-muted-foreground">(informativa)</span>}
                </td>
                <td className="py-2 pr-3">{TIPOS_AUSENCIA[a.tipo]}</td>
                <td className="py-2 pr-3">{fechaCorta(a.inicio)}/{a.inicio.slice(0, 4)}</td>
                <td className="py-2 pr-3">{fechaCorta(a.retorno)}/{a.retorno.slice(0, 4)}</td>
                <td className="max-w-[240px] truncate py-2 pr-3 text-muted-foreground">{a.nota}</td>
                <td className="py-2 text-right">
                  <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ id: a.id, datos: { ...a } })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => setBorrando(a)}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {lista?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  No hay ausencias cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar ausencia" : "Nueva ausencia"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Colaborador</Label>
                <Select value={form.datos.colaborador} onValueChange={(v) => set("colaborador", v)}>
                  <SelectTrigger aria-label="Colaborador"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLABORADORES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {nombreCorto(c)}{enRotacion(c) ? "" : " (informativa)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={form.datos.tipo} onValueChange={(v) => set("tipo", v as TipoAusencia)}>
                  <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS_AUSENCIA).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="aus-inicio">Desde</Label>
                  <CampoFecha
                    id="aus-inicio"
                    valor={form.datos.inicio}
                    onCambio={(f) =>
                      setForm((x) =>
                        x && { ...x, datos: { ...x.datos, inicio: f, retorno: x.datos.retorno > f ? x.datos.retorno : "" } },
                      )
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="aus-retorno">Vuelve el</Label>
                  <CampoFecha
                    id="aus-retorno"
                    valor={form.datos.retorno}
                    onCambio={(f) => set("retorno", f)}
                    deshabilitadas={form.datos.inicio ? { before: parseDiaStr(sumarDias(form.datos.inicio, 1)) } : undefined}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="aus-nota">Nota</Label>
                <Input id="aus-nota" maxLength={300} value={form.datos.nota} onChange={(e) => set("nota", e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={!form?.datos.inicio || !form?.datos.retorno}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!borrando}
        onOpenChange={(o) => !o && setBorrando(null)}
        titulo="Eliminar ausencia"
        descripcion={borrando ? `Se elimina la ausencia de ${nombreCorto(borrando.colaborador)} y se ajusta el horario ya generado.` : ""}
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
        descripcion={`El horario se vuelve a generar y se pierden ${pendiente?.editadas ?? 0} casillas que editaste a mano. ¿Continuar?`}
        accion="Continuar"
        tono="warning"
        onConfirmar={async () => {
          try {
            await pendiente?.ejecutar(true);
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
