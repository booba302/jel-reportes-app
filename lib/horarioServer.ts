import type postgres from "postgres";
import { sql } from "@/lib/db";
import { HttpError } from "@/lib/httpError";
import {
  fechaCorta,
  generarHorario,
  hoyEnZona,
  primerDia,
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
 * Escribe el cambio de un día especial y, si su mes ya está generado, rehace solo ese día
 * desde su estado guardado. Pide confirmación si hay casillas de ese día editadas a mano.
 */
export async function aplicarDiaEspecial(
  fecha: string,
  confirmar: boolean,
  escribir: (tx: Tx) => Promise<void>,
) {
  await sql.begin(async (tx) => {
    const generado = (await repo.mesesGenerados(tx)).includes(fecha.slice(0, 7));
    const estado = generado ? await repo.estadoEn(fecha, tx) : null;
    if (generado && !estado)
      throw new HttpError(409, "Ese día viene del Excel y no se puede rehacer: ajusta las casillas a mano.");
    const editadas = generado ? await repo.contarEditadas(fecha, fecha, tx) : 0;
    if (editadas > 0 && !confirmar)
      throw new HttpError(409, `Se perderían ${editadas} casillas editadas a mano. Confirma para continuar.`);
    await escribir(tx);
    if (!estado) return;
    const r = generarHorario(
      estado,
      fecha,
      fecha,
      await repo.ausenciasQueTocan(fecha, fecha, tx),
      await repo.especialesEntre(fecha, fecha, tx),
    );
    if (!r.ok) throw new HttpError(422, `No se guardó: ${sinCobertura(r.fechas)}`);
    await repo.reemplazarTurnosDia(fecha, r.turnos, tx);
  });
}

/** Casillas editadas a mano que se perderían al cambiar el día especial de `fecha`. */
export async function impactoDiaEspecial(fecha: string) {
  return (await repo.mesesGenerados()).includes(fecha.slice(0, 7)) ? repo.contarEditadas(fecha, fecha) : 0;
}
