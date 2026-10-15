import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import type {
  Ausencia,
  DatosAusencia,
  DiaEspecial,
  EstadoDia,
  EstadoRotacion,
  FilaTurno,
  Puesto,
  Turno,
} from "@/lib/horario";

/** Conexión normal o transacción en curso. */
type Db = postgres.Sql | postgres.TransactionSql;

const aAusencia = (r: postgres.Row): Ausencia => ({
  id: r.id,
  colaborador: r.colaborador,
  tipo: r.tipo,
  inicio: r.inicio,
  retorno: r.retorno,
  nota: r.nota,
});

export async function turnosEntre(desde: string, hasta: string, db: Db = sql): Promise<FilaTurno[]> {
  const filas = await db`
    select to_char(fecha, 'YYYY-MM-DD') as fecha, turno, puesto, colaborador, editado_manual
    from horario_turnos
    where fecha between ${desde}::date and ${hasta}::date
    order by fecha, turno, puesto desc`;
  return filas.map((r) => ({
    fecha: r.fecha,
    turno: r.turno as Turno,
    puesto: r.puesto as Puesto,
    colaborador: r.colaborador,
    editadoManual: r.editado_manual,
  }));
}

export async function mesesGenerados(db: Db = sql): Promise<string[]> {
  return (await db`select mes from horario_meses order by mes`).map((r) => r.mes as string);
}

export async function marcarMes(mes: string, por: string, db: Db = sql) {
  await db`insert into horario_meses (mes, generado_por) values (${mes}, ${por}) on conflict (mes) do nothing`;
}

export async function estadoEn(fecha: string, db: Db = sql): Promise<EstadoRotacion | null> {
  const [r] = await db`select estado from horario_estado where fecha = ${fecha}::date`;
  return r ? (r.estado as EstadoRotacion) : null;
}

export async function limitesHorario(db: Db = sql) {
  const [r] = await db`
    select (select to_char(min(fecha), 'YYYY-MM-DD') from horario_estado) as primer_estado,
           (select to_char(max(fecha), 'YYYY-MM-DD') from horario_turnos) as ultimo_generado`;
  return {
    primerEstado: (r.primer_estado as string | null) ?? null,
    ultimoGenerado: (r.ultimo_generado as string | null) ?? null,
  };
}

export async function contarEditadas(desde: string, hasta: string, db: Db = sql) {
  const [r] = await db`
    select count(*)::int as n from horario_turnos
    where editado_manual and fecha between ${desde}::date and ${hasta}::date`;
  return r.n as number;
}

/** Reemplaza los turnos de [desde, hasta] y los estados desde `desde`. Llamar dentro de una transacción. */
export async function guardarGeneracion(
  r: { turnos: FilaTurno[]; estados: EstadoDia[] },
  desde: string,
  hasta: string,
  db: Db = sql,
) {
  await db`delete from horario_turnos where fecha between ${desde}::date and ${hasta}::date`;
  await db`delete from horario_estado where fecha >= ${desde}::date`;
  const filas = r.turnos.map((t) => ({
    fecha: t.fecha,
    turno: t.turno,
    puesto: t.puesto,
    colaborador: t.colaborador,
    editado_manual: t.editadoManual,
  }));
  if (filas.length) await db`insert into horario_turnos ${db(filas)}`;
  for (const e of r.estados)
    await db`insert into horario_estado (fecha, estado)
             values (${e.fecha}::date, ${db.json(e.estado as unknown as postgres.JSONValue)})`;
}

export async function editarTurno(
  f: { fecha: string; turno: Turno; puesto: Puesto; colaborador: string },
  db: Db = sql,
) {
  const r = await db`
    update horario_turnos set colaborador = ${f.colaborador}, editado_manual = true
    where fecha = ${f.fecha}::date and turno = ${f.turno} and puesto = ${f.puesto}`;
  return r.count;
}


export async function todasAusencias(db: Db = sql): Promise<Ausencia[]> {
  return (await db`select id, colaborador, tipo, to_char(inicio, 'YYYY-MM-DD') as inicio,
                   to_char(retorno, 'YYYY-MM-DD') as retorno, nota
            from ausencias order by inicio desc`).map(aAusencia);
}

/** Ausencias que tocan algún día de [desde, hasta]. */
export async function ausenciasQueTocan(desde: string, hasta: string, db: Db = sql): Promise<Ausencia[]> {
  return (
    await db`select id, colaborador, tipo, to_char(inicio, 'YYYY-MM-DD') as inicio,
                    to_char(retorno, 'YYYY-MM-DD') as retorno, nota
             from ausencias
             where inicio <= ${hasta}::date and retorno > ${desde}::date
             order by inicio`
  ).map(aAusencia);
}

export async function ausenciaPorId(id: string, db: Db = sql): Promise<Ausencia | null> {
  const [r] = await db`select id, colaborador, tipo, to_char(inicio, 'YYYY-MM-DD') as inicio,
                         to_char(retorno, 'YYYY-MM-DD') as retorno, nota
                  from ausencias where id = ${id}::uuid`;
  return r ? aAusencia(r) : null;
}

export async function crearAusencia(a: DatosAusencia, por: string, db: Db = sql) {
  await db`
    insert into ausencias (colaborador, tipo, inicio, retorno, nota, creado_por)
    values (${a.colaborador}, ${a.tipo}, ${a.inicio}::date, ${a.retorno}::date, ${a.nota}, ${por})`;
}

export async function actualizarAusencia(id: string, a: DatosAusencia, db: Db = sql) {
  await db`
    update ausencias set colaborador = ${a.colaborador}, tipo = ${a.tipo},
      inicio = ${a.inicio}::date, retorno = ${a.retorno}::date, nota = ${a.nota}
    where id = ${id}::uuid`;
}

export async function eliminarAusencia(id: string, db: Db = sql) {
  await db`delete from ausencias where id = ${id}::uuid`;
}

const aEspecial = (r: postgres.Row): DiaEspecial => ({
  fecha: r.fecha,
  personasManana: r.personas_manana,
  personasTarde: r.personas_tarde,
  horarioManana: r.horario_manana,
  horarioTarde: r.horario_tarde,
  nota: r.nota,
});

export async function especialesEntre(desde: string, hasta: string, db: Db = sql): Promise<DiaEspecial[]> {
  return (
    await db`select to_char(fecha, 'YYYY-MM-DD') as fecha, personas_manana, personas_tarde,
                    horario_manana, horario_tarde, nota
             from dias_especiales where fecha between ${desde}::date and ${hasta}::date order by fecha`
  ).map(aEspecial);
}

export async function todosEspeciales(db: Db = sql): Promise<DiaEspecial[]> {
  return (
    await db`select to_char(fecha, 'YYYY-MM-DD') as fecha, personas_manana, personas_tarde,
                    horario_manana, horario_tarde, nota
             from dias_especiales order by fecha desc`
  ).map(aEspecial);
}

export async function guardarEspecial(d: DiaEspecial, por: string, db: Db = sql) {
  await db`
    insert into dias_especiales (fecha, personas_manana, personas_tarde, horario_manana, horario_tarde, nota, creado_por)
    values (${d.fecha}::date, ${d.personasManana}, ${d.personasTarde}, ${d.horarioManana}, ${d.horarioTarde}, ${d.nota}, ${por})
    on conflict (fecha) do update set personas_manana = excluded.personas_manana,
      personas_tarde = excluded.personas_tarde, horario_manana = excluded.horario_manana,
      horario_tarde = excluded.horario_tarde, nota = excluded.nota`;
}

export async function eliminarEspecial(fecha: string, db: Db = sql) {
  return (await db`delete from dias_especiales where fecha = ${fecha}::date`).count;
}

export async function enlaceActivo(anio: number, db: Db = sql): Promise<string | null> {
  const [r] = await db`select id from horario_enlaces where anio = ${anio} and activo`;
  return r ? (r.id as string) : null;
}

/** Crea el enlace del año y desactiva el anterior, si había. */
export async function crearEnlace(anio: number, por: string): Promise<string> {
  const id = randomBytes(16).toString("base64url");
  await sql.begin(async (tx) => {
    await tx`update horario_enlaces set activo = false where anio = ${anio} and activo`;
    await tx`insert into horario_enlaces (id, anio, creado_por) values (${id}, ${anio}, ${por})`;
  });
  return id;
}

export async function enlacePorId(id: string, db: Db = sql) {
  const [r] = await db`select anio, activo from horario_enlaces where id = ${id}`;
  return r ? { anio: r.anio as number, activo: r.activo as boolean } : null;
}
