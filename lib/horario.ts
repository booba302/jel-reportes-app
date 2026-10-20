// Horarios de turnos de retiros internacionales: reglas, fechas y generador.
// Todo aquí es puro (sin base de datos) para poder probarlo contra el Excel histórico.

export const ZONA_HORARIA = "America/Caracas";
/** Primer mes del sistema (se importó del Excel). */
export const MES_INICIO = "2026-10";
/** Con menos personas no hay regla de rotación definida. */
export const MINIMO_PERSONAS = 5;

/** Quienes rotan. El orden solo importa como desempate al volver varios el mismo día. */
export const ROTACION: readonly string[] = [
  "rafael.benitez",
  "angel.aleman",
  "juan.salcedo",
  "shirley.perez",
  "angel.gomez",
  "gabriel.amariscua",
];

const NOMBRES: Record<string, string> = {
  "rafael.benitez": "Rafael B.",
  "angel.aleman": "Angel A.",
  "juan.salcedo": "Juan S.",
  "shirley.perez": "Shirley P.",
  "angel.gomez": "Angel G.",
  "gabriel.amariscua": "Gabriel A.",
  "franklin.sanchez": "Franklin S.",
};

/** A quién se le puede cargar una ausencia: la rotación más las personas informativas. */
export const COLABORADORES = Object.keys(NOMBRES);
export const nombreCorto = (c: string) => NOMBRES[c] ?? c;
export const enRotacion = (c: string) => ROTACION.includes(c);

export type Turno = "manana" | "tarde";
export type Puesto = "pen_usd_mxn" | "clp";
export const TURNOS: readonly Turno[] = ["manana", "tarde"];
export const PUESTOS: readonly Puesto[] = ["pen_usd_mxn", "clp"];
export const ETIQUETA_TURNO: Record<Turno, string> = { manana: "Mañana", tarde: "Tarde" };
export const HORA_TURNO: Record<Turno, string> = {
  manana: "08:00 a.m. – 03:00 p.m.",
  tarde: "03:00 p.m. – 10:00 p.m.",
};
export const ETIQUETA_PUESTO: Record<Puesto, string> = { pen_usd_mxn: "PEN/USD/MXN", clp: "CLP" };

export const TIPOS_AUSENCIA = { vacaciones: "Vacaciones", medica: "Médica", otra: "Otra" } as const;
export type TipoAusencia = keyof typeof TIPOS_AUSENCIA;
export const esTipoAusencia = (t: unknown): t is TipoAusencia =>
  typeof t === "string" && Object.prototype.hasOwnProperty.call(TIPOS_AUSENCIA, t);

/** `retorno` es el primer día de vuelta (exclusivo), igual que la hoja "Vacaciones" del Excel. */
export interface AusenciaRango {
  colaborador: string;
  inicio: string;
  retorno: string;
}
export interface Ausencia extends AusenciaRango {
  id: string;
  tipo: TipoAusencia;
  nota: string;
}

/**
 * Día con turnos reducidos (Navidad, 31/12…). Nadie se salta: con 1 persona trabaja solo el
 * siguiente del orden (todas las monedas) y el próximo turno sigue desde quien venía después;
 * con 0 el turno se cierra sin consumir a nadie.
 */
export type Personas = 0 | 1 | 2;
export interface DiaEspecial {
  fecha: string;
  personasManana: Personas;
  personasTarde: Personas;
  /** Vacío = horario normal del turno. */
  horarioManana: string;
  horarioTarde: string;
  nota: string;
}
export const personasTurno = (e: DiaEspecial | undefined, turno: Turno): Personas =>
  !e ? 2 : turno === "manana" ? e.personasManana : e.personasTarde;
export const horarioTurno = (e: DiaEspecial | undefined, turno: Turno) =>
  (turno === "manana" ? e?.horarioManana : e?.horarioTarde) || HORA_TURNO[turno];
export const TODAS_LAS_MONEDAS = "Todas las monedas";

/** Horas elegibles para un día especial, en punto: "08:00" … "22:00". */
export const HORAS = Array.from({ length: 15 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);
/** "15:00" → "03:00 p.m." */
export function formatoHora(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
}
export const rangoHorario = (desde: string, hasta: string) => `${formatoHora(desde)} – ${formatoHora(hasta)}`;
/** "08:00 a.m. – 03:00 p.m." → { desde: "08:00", hasta: "15:00" }; null si no tiene ese formato. */
export function separarHorario(texto: string): { desde: string; hasta: string } | null {
  const m = /^(\d{2}):(\d{2}) ([ap])\.m\. – (\d{2}):(\d{2}) ([ap])\.m\.$/.exec(texto.trim());
  if (!m) return null;
  const a24 = (h: string, min: string, ap: string) => {
    const n = Number(h);
    if (n < 1 || n > 12 || (min !== "00" && min !== "30")) return null;
    return `${String((n % 12) + (ap === "p" ? 12 : 0)).padStart(2, "0")}:${min}`;
  };
  const desde = a24(m[1], m[2], m[3]);
  const hasta = a24(m[4], m[5], m[6]);
  return desde && hasta ? { desde, hasta } : null;
}
/** "1 persona, todas las monedas · 08:00 a.m. – 12:00 p.m." o "Cerrado". */
export function describirTurnoEspecial(e: DiaEspecial, turno: Turno) {
  const n = personasTurno(e, turno);
  if (n === 0) return "Cerrado";
  const horario = turno === "manana" ? e.horarioManana : e.horarioTarde;
  return [n === 1 ? "1 persona, todas las monedas" : "2 personas", horario].filter(Boolean).join(" · ");
}

export interface FilaTurno {
  fecha: string;
  turno: Turno;
  puesto: Puesto;
  colaborador: string;
  editadoManual: boolean;
}

/**
 * Estado de la rotación al inicio de un día. Cada turno toma a orden[pos] y orden[pos+1]:
 * el primero va a PEN/USD/MXN y el segundo a CLP (al revés si `invertido`).
 * Con un número par de personas los puestos se invierten cada `orden.length` turnos
 * (con 6: cada 3 días); `contador` cuenta los turnos de la fase actual.
 */
export interface EstadoRotacion {
  orden: string[];
  pos: number;
  invertido: boolean;
  contador: number;
}
export interface EstadoDia {
  fecha: string;
  estado: EstadoRotacion;
}
export type ResultadoGeneracion =
  | { ok: true; turnos: FilaTurno[]; estados: EstadoDia[] }
  | { ok: false; fechas: string[] };

// ── Fechas "YYYY-MM-DD" / "YYYY-MM", sin zona horaria ─────────────────────

export const sumarDias = (fecha: string, n: number) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
export const sumarMeses = (mes: string, n: number) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
export const primerDia = (mes: string) => `${mes}-01`;
export const ultimoDia = (mes: string) => sumarDias(primerDia(sumarMeses(mes, 1)), -1);
export const diasDelMes = (mes: string) => {
  const dias: string[] = [];
  for (let f = primerDia(mes); f.startsWith(mes); f = sumarDias(f, 1)) dias.push(f);
  return dias;
};

export const estaAusente = (c: string, fecha: string, ausencias: AusenciaRango[]) =>
  ausencias.some((a) => a.colaborador === c && a.inicio <= fecha && fecha < a.retorno);

// ── Generador ─────────────────────────────────────────────────────────────

/** Pasa la inversión al orden: queda reflejando los puestos tal como se trabajan. */
function aplanar(e: EstadoRotacion): EstadoRotacion {
  if (!e.invertido) return { ...e, contador: 0 };
  const n = e.orden.length;
  const orden = [...e.orden];
  for (let j = 0; j < n; j += 2) {
    const a = (e.pos + j) % n;
    const b = (e.pos + j + 1) % n;
    [orden[a], orden[b]] = [orden[b], orden[a]];
  }
  return { orden, pos: e.pos, invertido: false, contador: 0 };
}

/**
 * Ajusta el orden a quienes están disponibles hoy.
 * Quien vuelve entra como compañero (CLP) del siguiente turno: solo retrasa a los demás,
 * así que nadie queda con turnos seguidos. Quien sale se quita y se sigue desde la posición actual.
 */
function ajustar(e: EstadoRotacion, disponibles: string[]): EstadoRotacion {
  const entran = disponibles.filter((c) => !e.orden.includes(c));
  const salen = e.orden.filter((c) => !disponibles.includes(c));
  if (!entran.length && !salen.length) return e;
  const base = aplanar(e);
  const orden = [...base.orden];
  let pos = base.pos;
  entran.forEach((c, k) => orden.splice(pos + 1 + k, 0, c));
  for (const c of salen) {
    const i = orden.indexOf(c);
    orden.splice(i, 1);
    if (i < pos) pos--;
  }
  if (pos >= orden.length) pos = 0;
  return { orden, pos, invertido: false, contador: 0 };
}

/** Pasa al turno siguiente consumiendo `personas` del orden (2 en un turno normal). */
function avanzar(e: EstadoRotacion, personas = 2): EstadoRotacion {
  const n = e.orden.length;
  let { invertido, contador } = e;
  contador++;
  if (n % 2 === 0 && contador === n) {
    invertido = !invertido;
    contador = 0;
  }
  return { orden: e.orden, pos: (e.pos + personas) % n, invertido, contador };
}

/** Genera [desde, hasta] partiendo del estado al inicio de `desde`. */
export function generarHorario(
  estadoInicial: EstadoRotacion,
  desde: string,
  hasta: string,
  ausencias: AusenciaRango[],
  especiales: DiaEspecial[] = [],
): ResultadoGeneracion {
  const especialDe = new Map(especiales.map((d) => [d.fecha, d]));
  const turnos: FilaTurno[] = [];
  const estados: EstadoDia[] = [];
  const sinCobertura: string[] = [];
  let e = estadoInicial;
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    const disponibles = ROTACION.filter((c) => !estaAusente(c, fecha, ausencias));
    if (disponibles.length < MINIMO_PERSONAS) {
      sinCobertura.push(fecha);
      continue;
    }
    // Se guarda ANTES de ajustar: regenerar desde aquí con otras ausencias decide de nuevo quién sale o vuelve.
    estados.push({ fecha, estado: e });
    e = ajustar(e, disponibles);
    for (const turno of TURNOS) {
      const n = e.orden.length;
      const a = e.orden[e.pos % n];
      const b = e.orden[(e.pos + 1) % n];
      const [pen, clp] = e.invertido ? [b, a] : [a, b];
      const personas = personasTurno(especialDe.get(fecha), turno);
      if (personas === 2) {
        turnos.push(
          { fecha, turno, puesto: "pen_usd_mxn", colaborador: pen, editadoManual: false },
          { fecha, turno, puesto: "clp", colaborador: clp, editadoManual: false },
        );
        e = avanzar(e);
      } else if (personas === 1) {
        // Solo trabaja el siguiente del orden; el próximo turno sigue desde quien venía después.
        turnos.push({ fecha, turno, puesto: "pen_usd_mxn", colaborador: a, editadoManual: false });
        e = avanzar(e, 1);
      }
      // Turno cerrado: no consume a nadie del orden.
    }
  }
  if (sinCobertura.length) return { ok: false, fechas: sinCobertura };
  estados.push({ fecha: sumarDias(hasta, 1), estado: e });
  return { ok: true, turnos, estados };
}

// ── Validación y formato ──────────────────────────────────────────────────

export const esMes = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const esFecha = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && sumarDias(s, 0) === s;
/** "2026-09-14" → "14/09" */
export const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** Hoy en Venezuela, "YYYY-MM-DD". */
export const hoyEnZona = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);

/** Meses del enlace de `anio`: generados, desde el inicio del sistema (o enero) hasta el mes en curso. */
export function mesesVisibles(anio: number, hoy: string, generados: string[]) {
  const desde = anio === Number(MES_INICIO.slice(0, 4)) ? MES_INICIO : `${anio}-01`;
  return generados
    .filter((m) => m.startsWith(`${anio}-`) && m >= desde && m >= MES_INICIO && m <= hoy.slice(0, 7))
    .sort();
}

/** Solo se puede eliminar el último mes generado, y solo si es posterior al mes en curso. */
export const puedeEliminarMes = (mes: string, hoy: string, generados: string[]) =>
  generados.length > 0 && mes === generados[generados.length - 1] && mes > hoy.slice(0, 7);

// ── Regeneración por cambios en ausencias ─────────────────────────────────

/**
 * Tramo a regenerar cuando una ausencia se crea (antes = null), edita o elimina (despues = null).
 * Nunca antes de hoy ni de los días que tienen estado guardado; null si no hay nada que regenerar.
 */
export function rangoRegeneracion(
  cambio: { antes: AusenciaRango | null; despues: AusenciaRango | null },
  ctx: { hoy: string; primerEstado: string | null; ultimoGenerado: string | null },
): { desde: string; hasta: string } | null {
  const { antes, despues } = cambio;
  if (!ctx.primerEstado || !ctx.ultimoGenerado) return null;
  if (
    antes && despues &&
    antes.colaborador === despues.colaborador &&
    antes.inicio === despues.inicio &&
    antes.retorno === despues.retorno
  )
    return null;
  const limite = ctx.hoy > ctx.primerEstado ? ctx.hoy : ctx.primerEstado;
  const afectadas = [antes, despues].filter(
    (a): a is AusenciaRango => !!a && enRotacion(a.colaborador) && a.retorno > limite,
  );
  if (!afectadas.length) return null;
  // Misma persona: desde el primer día en que los dos rangos difieren.
  const inicio =
    antes && despues && antes.colaborador === despues.colaborador && antes.inicio === despues.inicio
      ? [antes.retorno, despues.retorno].sort()[0]
      : afectadas.map((a) => a.inicio).sort()[0];
  const desde = inicio > limite ? inicio : limite;
  return desde <= ctx.ultimoGenerado ? { desde, hasta: ctx.ultimoGenerado } : null;
}

// ── Avisos al editar a mano ───────────────────────────────────────────────

export const claveTurno = (fecha: string, turno: Turno, puesto: Puesto) => `${fecha}|${turno}|${puesto}`;

const indiceTurno = (fecha: string, turno: Turno) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) / 86_400_000) * 2 + (turno === "tarde" ? 1 : 0);
};

/** Casillas con problema → motivo. No bloquea: el administrador decide. */
export function conflictos(
  turnos: Pick<FilaTurno, "fecha" | "turno" | "puesto" | "colaborador">[],
  ausencias: AusenciaRango[],
) {
  const porIndice = new Map<number, string[]>();
  for (const t of turnos) {
    const i = indiceTurno(t.fecha, t.turno);
    porIndice.set(i, [...(porIndice.get(i) ?? []), t.colaborador]);
  }
  const avisos = new Map<string, string>();
  for (const t of turnos) {
    const i = indiceTurno(t.fecha, t.turno);
    const clave = claveTurno(t.fecha, t.turno, t.puesto);
    if (estaAusente(t.colaborador, t.fecha, ausencias)) avisos.set(clave, "Está ausente ese día");
    else if (porIndice.get(i)!.filter((c) => c === t.colaborador).length > 1)
      avisos.set(clave, "Ocupa los dos puestos del turno");
    else if (porIndice.get(i - 1)?.includes(t.colaborador) || porIndice.get(i + 1)?.includes(t.colaborador))
      avisos.set(clave, "Tiene turnos seguidos");
  }
  return avisos;
}

// ── Ausencias desde la API ────────────────────────────────────────────────

export type DatosAusencia = Omit<Ausencia, "id">;

/** Devuelve los datos limpios o el mensaje de error. */
export function validarAusencia(b: unknown): DatosAusencia | string {
  const o = (b ?? {}) as Record<string, unknown>;
  const colaborador = String(o.colaborador ?? "");
  const { tipo, inicio, retorno } = o;
  if (!COLABORADORES.includes(colaborador)) return "Colaborador inválido.";
  if (!esTipoAusencia(tipo)) return "Tipo de ausencia inválido.";
  if (!esFecha(inicio) || !esFecha(retorno)) return "Fechas inválidas.";
  if (retorno <= inicio) return "El retorno debe ser posterior al inicio.";
  return { colaborador, tipo, inicio, retorno, nota: String(o.nota ?? "").trim().slice(0, 300) };
}

// ── Días especiales desde la API ──────────────────────────────────────────

const esPersonas = (n: unknown): n is Personas => n === 0 || n === 1 || n === 2;

/** Devuelve los datos limpios o el mensaje de error. */
export function validarDiaEspecial(b: unknown): DiaEspecial | string {
  const o = (b ?? {}) as Record<string, unknown>;
  const { fecha, personasManana, personasTarde } = o;
  if (!esFecha(fecha)) return "Fecha inválida.";
  if (!esPersonas(personasManana) || !esPersonas(personasTarde)) return "Cantidad de personas inválida.";
  const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  for (const h of [texto(o.horarioManana, 40), texto(o.horarioTarde, 40)]) {
    const r = h ? separarHorario(h) : null;
    if (h && (!r || !HORAS.includes(r.desde) || !HORAS.includes(r.hasta) || r.hasta <= r.desde))
      return "Horario inválido: elige horas en punto entre 08:00 a.m. y 10:00 p.m., con el fin después del inicio.";
  }
  return {
    fecha,
    personasManana,
    personasTarde,
    horarioManana: personasManana ? texto(o.horarioManana, 40) : "",
    horarioTarde: personasTarde ? texto(o.horarioTarde, 40) : "",
    nota: texto(o.nota, 100),
  };
}
