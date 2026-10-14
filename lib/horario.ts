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

function avanzar(e: EstadoRotacion): EstadoRotacion {
  const n = e.orden.length;
  let { invertido, contador } = e;
  contador++;
  if (n % 2 === 0 && contador === n) {
    invertido = !invertido;
    contador = 0;
  }
  return { orden: e.orden, pos: (e.pos + 2) % n, invertido, contador };
}

/** Genera [desde, hasta] partiendo del estado al inicio de `desde`. */
export function generarHorario(
  estadoInicial: EstadoRotacion,
  desde: string,
  hasta: string,
  ausencias: AusenciaRango[],
): ResultadoGeneracion {
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
    e = ajustar(e, disponibles);
    estados.push({ fecha, estado: e });
    for (const turno of TURNOS) {
      const n = e.orden.length;
      const a = e.orden[e.pos % n];
      const b = e.orden[(e.pos + 1) % n];
      const [pen, clp] = e.invertido ? [b, a] : [a, b];
      turnos.push(
        { fecha, turno, puesto: "pen_usd_mxn", colaborador: pen, editadoManual: false },
        { fecha, turno, puesto: "clp", colaborador: clp, editadoManual: false },
      );
      e = avanzar(e);
    }
  }
  if (sinCobertura.length) return { ok: false, fechas: sinCobertura };
  estados.push({ fecha: sumarDias(hasta, 1), estado: e });
  return { ok: true, turnos, estados };
}
