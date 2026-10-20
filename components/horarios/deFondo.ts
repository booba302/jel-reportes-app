import { toast } from "sonner";

/** Cambio que espera a que el usuario acepte perder casillas editadas a mano. */
export type Pendiente = {
  editadas: number;
  ejecutar: () => void;
  cancelar?: () => void;
  /** Se marca al aceptar, para que el cierre del diálogo no lo cuente como cancelado. */
  hecho?: boolean;
};

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto);

/**
 * Corre un cambio de horario de fondo con un toast de "en curso" y otro al terminar.
 * Antes mide cuántas casillas editadas a mano se perderían; si hay alguna, delega en
 * `pedirConfirmacion` y solo sigue si el usuario acepta.
 */
export async function cambioDeFondo(o: {
  medir: () => Promise<number>;
  ejecutar: (confirmar: boolean) => Promise<void>;
  cargando: string;
  listo: string;
  alTerminar: () => void;
  /** Al fallar o cancelar, p. ej. para reabrir el formulario con lo que se escribió. */
  alFallar?: () => void;
  pedirConfirmacion: (p: Pendiente) => void;
}) {
  const correr = async (confirmar: boolean, id: string | number) => {
    try {
      await o.ejecutar(confirmar);
      toast.success(o.listo, { id });
      o.alTerminar();
    } catch (err) {
      toast.error(mensaje(err, "No se pudo guardar."), { id });
      o.alFallar?.();
    }
  };

  const id = toast.loading(o.cargando);
  let editadas: number;
  try {
    editadas = await o.medir();
  } catch (err) {
    toast.error(mensaje(err, "No se pudo guardar."), { id });
    o.alFallar?.();
    return;
  }
  if (editadas === 0) return correr(false, id);
  toast.dismiss(id);
  o.pedirConfirmacion({
    editadas,
    ejecutar: () => void correr(true, toast.loading(o.cargando)),
    cancelar: o.alFallar,
  });
}

/** Props del diálogo de confirmación: aceptar lanza el cambio de fondo y cierra al instante. */
export const confirmarPendiente = (pendiente: Pendiente | null, limpiar: () => void) => ({
  open: !!pendiente,
  onOpenChange: (abierto: boolean) => {
    if (abierto) return;
    if (pendiente && !pendiente.hecho) pendiente.cancelar?.();
    limpiar();
  },
  onConfirmar: async () => {
    if (!pendiente) return;
    pendiente.hecho = true;
    pendiente.ejecutar();
  },
});
