import type postgres from "postgres";
import { sql } from "@/lib/db";
import { HttpError } from "@/lib/httpError";
import {
  fechaCorta,
  generarHorario,
  hoyEnZona,
  primerDia,
  puedeEliminarMes,
  rangoRegeneracion,
  ultimoDia,
  type AusenciaRango,
} from "@/lib/horario";
import * as repo from "@/lib/horarioRepo";

type Tx = postgres.TransactionSql;

const sinCobertura = (fechas: string[]) =>
  `quedan menos de 5 personas el ${fechas.map(fechaCorta).join(", ")}. Ajusta las ausencias: la regla para 4 personas aún no existe.`;

/** Genera un mes completo partiendo del estado guardado para su día 1. */
export async function generarMes(mes: string, por: string) {
  await sql.begin(async (tx) => {
    if ((await repo.mesesGenerados(tx)).includes(mes)) throw new HttpError(409, "Ese mes ya está generado.");
    const desde = primerDia(mes);
    const hasta = ultimoDia(mes);
    const estado = await repo.estadoEn(desde, tx);
    if (!estado) throw new HttpError(409, "Primero genera el mes anterior.");
    const r = generarHorario(
      estado,
      desde,
      hasta,
      await repo.ausenciasQueTocan(desde, hasta, tx),
      await repo.especialesEntre(desde, hasta, tx),
    );
    if (!r.ok) throw new HttpError(422, `No se generó: ${sinCobertura(r.fechas)}`);
    await repo.guardarGeneracion(r, desde, hasta, tx);
    await repo.marcarMes(mes, por, tx);
  });
}

/** Elimina el último mes generado si aún no empezó; se puede volver a generar después. */
export async function eliminarMes(mes: string) {
  await sql.begin(async (tx) => {
    if (!puedeEliminarMes(mes, hoyEnZona(), await repo.mesesGenerados(tx)))
      throw new HttpError(409, "Solo se puede eliminar el último mes generado, y no el mes en curso.");
    const desde = primerDia(mes);
    if (!(await repo.estadoEn(desde, tx)))
      throw new HttpError(409, "Ese mes no se podría volver a generar: no se elimina.");
    await repo.borrarMes(mes, desde, ultimoDia(mes), tx);
  });
}

/**
 * Lo que ven los colaboradores de un mes: turnos sin marcas de edición y ausencias sin
 * nota ni tipo (más allá de "Vacaciones"/"Ausencia").
 */
export async function vistaMes(mes: string) {
  const [turnos, ausencias, especiales] = await Promise.all([
    repo.turnosEntre(primerDia(mes), ultimoDia(mes)),
    repo.ausenciasQueTocan(primerDia(mes), ultimoDia(mes)),
    repo.especialesEntre(primerDia(mes), ultimoDia(mes)),
  ]);
  return {
    turnos: turnos.map(({ fecha, turno, puesto, colaborador }) => ({ fecha, turno, puesto, colaborador })),
    ausencias: ausencias.map((a) => ({
      colaborador: a.colaborador,
      tipo: a.tipo === "vacaciones" ? "Vacaciones" : "Ausencia",
      inicio: a.inicio,
      retorno: a.retorno,
    })),
    especiales,
  };
}

export type CambioAusencia = { antes: AusenciaRango | null; despues: AusenciaRango | null };

/** Qué tramo se regeneraría y cuántas casillas editadas a mano se perderían. */
export async function impactoCambio(c: CambioAusencia, db: Tx | postgres.Sql = sql) {
  const ctx = { hoy: hoyEnZona(), ...(await repo.limitesHorario(db)) };
  const rango = rangoRegeneracion(c, ctx);
  return { rango, editadas: rango ? await repo.contarEditadas(rango.desde, rango.hasta, db) : 0 };
}

/** Escribe el cambio de la ausencia y regenera lo afectado, todo o nada. */
export async function aplicarCambio(
  c: CambioAusencia,
  confirmar: boolean,
  escribir: (tx: Tx) => Promise<void>,
) {
  await sql.begin(async (tx) => {
    const { rango, editadas } = await impactoCambio(c, tx);
    if (editadas > 0 && !confirmar)
      throw new HttpError(409, `Se perderían ${editadas} casillas editadas a mano. Confirma para continuar.`);
    await escribir(tx);
    if (!rango) return;
    const estado = await repo.estadoEn(rango.desde, tx);
    if (!estado) throw new HttpError(500, "Falta el estado de la rotación para regenerar.");
    const r = generarHorario(
      estado,
      rango.desde,
      rango.hasta,
      await repo.ausenciasQueTocan(rango.desde, rango.hasta, tx),
      await repo.especialesEntre(rango.desde, rango.hasta, tx),
    );
    if (!r.ok) throw new HttpError(422, `No se guardó: con este cambio ${sinCobertura(r.fechas)}`);
    await repo.guardarGeneracion(r, rango.desde, rango.hasta, tx);
  });
}

/**
 * Tramo a rehacer al cambiar el día especial de `fecha`: desde ese día hasta el último generado,
 * porque un turno de 1 persona corre la rotación. null si ese día aún no está generado.
 */
async function rangoDiaEspecial(fecha: string, db: Tx | postgres.Sql) {
  const { ultimoGenerado } = await repo.limitesHorario(db);
  if (!ultimoGenerado || fecha > ultimoGenerado) return null;
  return { desde: fecha, hasta: ultimoGenerado };
}

/** Escribe el cambio de un día especial y rehace lo ya generado desde ese día, todo o nada. */
export async function aplicarDiaEspecial(
  fecha: string,
  confirmar: boolean,
  escribir: (tx: Tx) => Promise<void>,
) {
  await sql.begin(async (tx) => {
    const rango = await rangoDiaEspecial(fecha, tx);
    const estado = rango ? await repo.estadoEn(fecha, tx) : null;
    if (rango && fecha < hoyEnZona())
      throw new HttpError(409, "Ese día ya pasó y está generado: ajusta las casillas a mano.");
    if (rango && !estado)
      throw new HttpError(409, "Ese día viene del Excel y no se puede rehacer: ajusta las casillas a mano.");
    const editadas = rango ? await repo.contarEditadas(rango.desde, rango.hasta, tx) : 0;
    if (editadas > 0 && !confirmar)
      throw new HttpError(409, `Se perderían ${editadas} casillas editadas a mano. Confirma para continuar.`);
    await escribir(tx);
    if (!rango || !estado) return;
    const r = generarHorario(
      estado,
      rango.desde,
      rango.hasta,
      await repo.ausenciasQueTocan(rango.desde, rango.hasta, tx),
      await repo.especialesEntre(rango.desde, rango.hasta, tx),
    );
    if (!r.ok) throw new HttpError(422, `No se guardó: ${sinCobertura(r.fechas)}`);
    await repo.guardarGeneracion(r, rango.desde, rango.hasta, tx);
  });
}

/** Casillas editadas a mano que se perderían al cambiar el día especial de `fecha`. */
export async function impactoDiaEspecial(fecha: string) {
  const rango = await rangoDiaEspecial(fecha, sql);
  return rango ? repo.contarEditadas(rango.desde, rango.hasta) : 0;
}
