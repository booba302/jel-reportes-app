# Horarios de turnos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar, editar y publicar (enlace anual) el horario mensual de los 6 colaboradores de retiros internacionales, a partir de la regla de rotación y de las ausencias cargadas.

**Architecture:** Un generador puro (`lib/horario.ts`) produce los turnos y el estado de la rotación por día; se guardan en Postgres (Supabase) vía `lib/horarioRepo.ts` y `lib/horarioServer.ts` (transacciones). Rutas `/api/horarios/*` solo para admin y `/api/horario-publico/[id]` sin login. UI admin en `/horarios` y visor público en `/horario/[id]`.

**Tech Stack:** Next.js 16.2 (App Router, route handlers), React 19, TypeScript, `postgres` (postgres.js), vitest, shadcn/ui, Tailwind, `xlsx` (solo el script de importación).

**Spec:** `docs/superpowers/specs/2026-10-14-horarios-turnos-design.md`

## Global Constraints

- **AGENTS.md:** esta versión de Next tiene cambios incompatibles. Antes de escribir rutas o páginas, leer `node_modules/next/dist/docs/01-app/` (route handlers y dynamic routes). En route handlers `params` es una `Promise` (ver `app/api/expediente-publico/[id]/route.ts`).
- Turnos: **mañana 08:00–15:00**, **tarde 15:00–22:00**; puestos **PEN/USD/MXN** y **CLP**; 2 personas por turno, todos los días.
- Rotación fija (código, no UI): `rafael.benitez`, `angel.aleman`, `juan.salcedo`, `shirley.perez`, `angel.gomez`, `gabriel.amariscua`. `franklin.sanchez` solo informativo.
- Ausencias: `retorno` = primer día de vuelta (exclusivo).
- Mínimo **5** personas por día; con menos, no se genera y se avisa con las fechas.
- Zona horaria: **`America/Caracas`**. Primer mes del sistema: **`2026-10`**.
- Enlace público: uno activo por año, sin vencimiento; muestra solo meses generados entre `2026-10` (o enero) y el mes en curso; el servidor rechaza los demás.
- El navegador nunca habla con Postgres; rutas admin con `requireAdmin`.
- Textos de la UI y comentarios en español, con el estilo del repo (comentarios breves, nombres en español).
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **`DATABASE_URL`/`DIRECT_URL` de `.env.local` apuntan a producción.** No correr `db:esquema` ni el script de importación sin confirmación explícita del usuario (Task 9).

## Review Focus

1. **Editar una ausencia que ya pasó o solo cambiar la nota** — no debe regenerar nada ni borrar ediciones manuales. Test en Task 2 (`rangoRegeneracion`).
2. **Pedir un mes futuro por URL al enlace público** (`?mes=2026-11` el 14/10) — debe rechazarse aunque el mes ya esté generado. Test en Task 2 (`mesesVisibles`) y comprobación en Task 6.
3. **Cambio de día cerca de medianoche** — el 31/10 a las 23:30 de Caracas ya es 1/11 en UTC; noviembre no debe verse. Test en Task 2 (`hoyEnZona`).
4. **Una ausencia de un día (médica)** en medio de un mes — salida y vuelta al día siguiente sin turnos seguidos. Test de invariantes en Task 1.
5. **Regenerar desde la mitad de un mes** debe dar exactamente lo mismo que generar el mes entero si no cambió nada. Test en Task 1.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/horario.ts` (crear) | Constantes, tipos, fechas, generador puro, visibilidad, rango de regeneración, conflictos, validación de ausencias |
| `tests/horario.test.ts` (crear) | Pruebas del generador contra el Excel y de las reglas puras |
| `db/migraciones/002_horarios.sql` (crear) | Tablas `ausencias`, `horario_turnos`, `horario_estado`, `horario_meses`, `horario_enlaces` |
| `lib/horarioRepo.ts` (crear) | SQL de lectura/escritura |
| `lib/horarioServer.ts` (crear) | Generar mes y aplicar cambios de ausencias en transacción |
| `app/api/horarios/route.ts` (crear) | GET mes, POST generar |
| `app/api/horarios/turno/route.ts` (crear) | PATCH editar casilla |
| `app/api/horarios/ausencias/route.ts` (crear) | GET lista, POST crear |
| `app/api/horarios/ausencias/[id]/route.ts` (crear) | PATCH, DELETE |
| `app/api/horarios/ausencias/impacto/route.ts` (crear) | POST: cuántas casillas manuales se perderían |
| `app/api/horarios/enlace/route.ts` (crear) | GET (crea si falta), POST reemplazar |
| `app/api/horario-publico/[id]/route.ts` (crear) | Datos del enlace público |
| `components/horarios/CalendarioMes.tsx` (crear) | Calendario mensual + pie (compartido admin/público) |
| `components/horarios/EditarTurnoDialog.tsx` (crear) | Cambiar colaborador de una casilla |
| `components/horarios/AusenciasTab.tsx` (crear) | Tabla y formulario de ausencias |
| `components/horarios/EnlaceTab.tsx` (crear) | Copiar / reemplazar enlace |
| `app/(dashboard)/horarios/page.tsx` (crear) | Página admin con pestañas |
| `app/horario/[id]/page.tsx` (crear) | Visor público |
| `app/context/AuthContext.tsx:57-58` (modificar) | `/horario/` es ruta pública |
| `components/Sidebar.tsx` (modificar) | Entrada "Horarios" |
| `scripts/importar-horario-excel.mts` (crear) + `package.json` | Importación única de octubre y vacaciones |

---

### Task 1: Generador de la rotación

**Files:**
- Create: `lib/horario.ts`
- Test: `tests/horario.test.ts`

**Interfaces:**
- Produces (usados por todas las tareas siguientes):
  - `ROTACION: readonly string[]`, `COLABORADORES: string[]`, `nombreCorto(c: string): string`, `enRotacion(c: string): boolean`, `MINIMO_PERSONAS = 5`, `ZONA_HORARIA`, `MES_INICIO`
  - `type Turno = "manana" | "tarde"`, `type Puesto = "pen_usd_mxn" | "clp"`, `TURNOS`, `PUESTOS`, `ETIQUETA_TURNO`, `HORA_TURNO`, `ETIQUETA_PUESTO`
  - `TIPOS_AUSENCIA`, `type TipoAusencia`, `esTipoAusencia(t)`, `interface AusenciaRango {colaborador; inicio; retorno}`, `interface Ausencia extends AusenciaRango {id; tipo; nota}`
  - `interface FilaTurno {fecha; turno; puesto; colaborador; editadoManual}`
  - `interface EstadoRotacion {orden: string[]; pos: number; invertido: boolean; contador: number}`, `interface EstadoDia {fecha; estado}`
  - `type ResultadoGeneracion = {ok: true; turnos: FilaTurno[]; estados: EstadoDia[]} | {ok: false; fechas: string[]}`
  - `generarHorario(estado: EstadoRotacion, desde: string, hasta: string, ausencias: AusenciaRango[]): ResultadoGeneracion` — `estados` trae el estado al inicio de cada día de `[desde, hasta]` y el de `hasta + 1`.
  - Fechas: `sumarDias(f, n)`, `sumarMeses(mes, n)`, `primerDia(mes)`, `ultimoDia(mes)`, `diasDelMes(mes)`, `estaAusente(c, f, ausencias)`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/horario.test.ts`. Los datos son copia literal de `Horario 2026.xlsx` (columnas: fecha, mañana PEN, mañana CLP, tarde PEN, tarde CLP).

```ts
import { describe, expect, test } from "vitest";
import {
  estaAusente,
  generarHorario,
  type AusenciaRango,
  type EstadoRotacion,
  type FilaTurno,
} from "@/lib/horario";

const C = {
  RB: "rafael.benitez",
  AA: "angel.aleman",
  JS: "juan.salcedo",
  SP: "shirley.perez",
  AG: "angel.gomez",
  GA: "gabriel.amariscua",
} as const;
type Cod = keyof typeof C;
const DE = Object.fromEntries(Object.entries(C).map(([k, v]) => [v, k]));

const estado = (orden: Cod[], pos = 0, contador = 0): EstadoRotacion => ({
  orden: orden.map((c) => C[c]),
  pos,
  invertido: false,
  contador,
});
const aus = (c: Cod, inicio: string, retorno: string): AusenciaRango => ({ colaborador: C[c], inicio, retorno });

/** Turnos → líneas "fecha PEN-mañana CLP-mañana PEN-tarde CLP-tarde" con códigos. */
function lineas(turnos: FilaTurno[]) {
  const dias = new Map<string, string[]>();
  for (const t of turnos) {
    const i = (t.turno === "manana" ? 0 : 2) + (t.puesto === "pen_usd_mxn" ? 0 : 1);
    const d = dias.get(t.fecha) ?? ["", "", "", ""];
    d[i] = DE[t.colaborador];
    dias.set(t.fecha, d);
  }
  return [...dias].map(([f, d]) => `${f} ${d.join(" ")}`);
}

function generarOk(...args: Parameters<typeof generarHorario>) {
  const r = generarHorario(...args);
  if (!r.ok) throw new Error(`no generó: ${r.fechas.join(",")}`);
  return r;
}

const EXCEL_SEP_OCT = [
  "2026-09-01 GA RB AA AG", "2026-09-02 JS SP RB GA", "2026-09-03 AG AA SP JS",
  "2026-09-04 RB GA AG AA", "2026-09-05 SP JS GA RB", "2026-09-06 AA AG JS SP",
  "2026-09-07 GA RB AA AG", "2026-09-08 JS SP RB GA", "2026-09-09 AG AA SP JS",
  "2026-09-10 RB GA AG AA", "2026-09-11 SP JS GA RB", "2026-09-12 AA AG JS SP",
  "2026-09-13 GA RB AA AG", "2026-09-14 SP GA RB AA", "2026-09-15 AG SP GA RB",
  "2026-09-16 AA AG SP GA", "2026-09-17 RB AA AG SP", "2026-09-18 GA RB AA AG",
  "2026-09-19 SP GA RB AA", "2026-09-20 AG SP GA RB", "2026-09-21 AA AG SP GA",
  "2026-09-22 RB AA AG SP", "2026-09-23 GA RB AA AG", "2026-09-24 SP GA RB AA",
  "2026-09-25 AG SP GA RB", "2026-09-26 AA AG SP GA", "2026-09-27 RB AA AG SP",
  "2026-09-28 GA RB AA AG", "2026-09-29 SP GA RB AA", "2026-09-30 AG SP GA RB",
  "2026-10-01 AA AG SP GA", "2026-10-02 RB AA AG SP", "2026-10-03 GA RB AA AG",
  "2026-10-04 SP GA RB AA", "2026-10-05 AG SP GA RB", "2026-10-06 AA AG SP GA",
  "2026-10-07 RB AA AG SP", "2026-10-08 GA RB AA AG",
];

const EXCEL_AGO = [
  "2026-08-03 RB GA AG AA", "2026-08-04 JS RB GA AG", "2026-08-05 AA JS RB GA",
  "2026-08-06 AG AA JS RB", "2026-08-07 GA AG AA JS", "2026-08-08 RB GA AG AA",
  "2026-08-09 JS RB GA AG", "2026-08-10 AA JS RB GA", "2026-08-11 AG AA JS RB",
  "2026-08-12 GA AG AA JS", "2026-08-13 RB GA AG AA", "2026-08-14 JS RB GA AG",
  "2026-08-15 AA JS RB GA", "2026-08-16 AG AA JS RB", "2026-08-17 GA AG AA JS",
  "2026-08-18 RB GA AG AA", "2026-08-19 JS RB GA AG", "2026-08-20 AA JS RB GA",
  "2026-08-21 AG AA JS RB", "2026-08-22 GA AG AA JS", "2026-08-23 RB GA AG AA",
];

const EXCEL_FIN_OCT = [
  "2026-10-26 JS SP RB AG", "2026-10-27 AA JS SP RB", "2026-10-28 AG AA JS SP",
  "2026-10-29 RB AG AA JS", "2026-10-30 SP RB AG AA", "2026-10-31 JS SP RB AG",
];

/** Estado al 01/11/2026 que guarda la importación (Task 9). */
const ESTADO_1_NOV = estado(["JS", "SP", "RB", "AG", "AA"], 4);
const AUSENCIAS_NOV = [
  aus("GA", "2026-10-13", "2026-11-02"),
  aus("RB", "2026-11-02", "2026-12-02"),
  aus("SP", "2026-12-14", "2026-12-21"),
];

describe("generarHorario contra el Excel", () => {
  test("6 personas: 01/09 al 13/09", () => {
    const r = generarOk(estado(["GA", "RB", "AA", "AG", "JS", "SP"], 0, 3), "2026-09-01", "2026-09-13", []);
    expect(lineas(r.turnos)).toEqual(EXCEL_SEP_OCT.slice(0, 13));
  });

  test("sale Juan el 14/09: 01/09 al 08/10", () => {
    const r = generarOk(
      estado(["GA", "RB", "AA", "AG", "JS", "SP"], 0, 3),
      "2026-09-01",
      "2026-10-08",
      [aus("JS", "2026-09-14", "2026-10-09")],
    );
    expect(lineas(r.turnos)).toEqual(EXCEL_SEP_OCT);
  });

  test("5 personas sin Shirley: 03/08 al 23/08", () => {
    const r = generarOk(estado(["RB", "GA", "AG", "AA", "JS"]), "2026-08-03", "2026-08-23", [
      aus("SP", "2026-08-03", "2026-08-24"),
    ]);
    expect(lineas(r.turnos)).toEqual(EXCEL_AGO);
  });

  test("5 personas sin Gabriel: 26/10 al 31/10", () => {
    const r = generarOk(estado(["JS", "SP", "RB", "AG", "AA"]), "2026-10-26", "2026-10-31", AUSENCIAS_NOV);
    expect(lineas(r.turnos)).toEqual(EXCEL_FIN_OCT);
  });

  test("el estado importado del 01/11 da el 01/11 del Excel", () => {
    const r = generarOk(ESTADO_1_NOV, "2026-11-01", "2026-11-01", AUSENCIAS_NOV);
    expect(lineas(r.turnos)).toEqual(["2026-11-01 AA JS SP RB"]);
  });
});

describe("generarHorario: reglas", () => {
  const largas = [...AUSENCIAS_NOV, aus("AA", "2027-01-05", "2027-01-06"), aus("AG", "2027-01-07", "2027-01-09")];

  test("nadie trabaja dos turnos seguidos, ni ausente, ni dos puestos a la vez", () => {
    const r = generarOk(ESTADO_1_NOV, "2026-11-01", "2027-03-31", largas);
    const porTurno: string[][] = [];
    for (let i = 0; i < r.turnos.length; i += 2) {
      const [a, b] = [r.turnos[i], r.turnos[i + 1]];
      expect(a.fecha).toBe(b.fecha);
      expect(a.colaborador).not.toBe(b.colaborador);
      expect(estaAusente(a.colaborador, a.fecha, largas)).toBe(false);
      expect(estaAusente(b.colaborador, b.fecha, largas)).toBe(false);
      porTurno.push([a.colaborador, b.colaborador]);
    }
    for (let i = 1; i < porTurno.length; i++)
      for (const c of porTurno[i]) expect(porTurno[i - 1]).not.toContain(c);
  });

  test("con 4 disponibles no genera y devuelve las fechas", () => {
    const r = generarHorario(ESTADO_1_NOV, "2026-11-01", "2026-11-30", [
      ...AUSENCIAS_NOV,
      aus("JS", "2026-11-10", "2026-11-12"),
    ]);
    expect(r).toEqual({ ok: false, fechas: ["2026-11-10", "2026-11-11"] });
  });

  test("estados: uno por día más el del día siguiente al último", () => {
    const r = generarOk(ESTADO_1_NOV, "2026-11-01", "2026-11-30", AUSENCIAS_NOV);
    expect(r.estados).toHaveLength(31);
    expect(r.estados[0].fecha).toBe("2026-11-01");
    expect(r.estados.at(-1)!.fecha).toBe("2026-12-01");
    expect(r.turnos).toHaveLength(30 * 4);
  });

  test("regenerar desde la mitad con el estado guardado da lo mismo", () => {
    const mes = generarOk(ESTADO_1_NOV, "2026-11-01", "2026-11-30", AUSENCIAS_NOV);
    const e15 = mes.estados.find((e) => e.fecha === "2026-11-15")!.estado;
    const cola = generarOk(e15, "2026-11-15", "2026-11-30", AUSENCIAS_NOV);
    expect(cola.turnos).toEqual(mes.turnos.filter((t) => t.fecha >= "2026-11-15"));
    expect(cola.estados.at(-1)).toEqual(mes.estados.at(-1));
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/horario.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/horario"`.

- [ ] **Step 3: Implementar `lib/horario.ts`**

```ts
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
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/horario.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/horario.ts tests/horario.test.ts
git commit -m "feat(horarios): generador de la rotación verificado contra el Excel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reglas puras de visibilidad, regeneración, conflictos y validación

**Files:**
- Modify: `lib/horario.ts` (agregar al final)
- Test: `tests/horario.test.ts` (agregar al final)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `hoyEnZona(ahora?: Date): string` — "YYYY-MM-DD" en Caracas
  - `esMes(s: unknown): s is string`, `esFecha(s: unknown): s is string`, `fechaCorta(f: string): string` ("14/09")
  - `mesesVisibles(anio: number, hoy: string, generados: string[]): string[]`
  - `rangoRegeneracion(cambio: {antes: AusenciaRango | null; despues: AusenciaRango | null}, ctx: {hoy: string; primerEstado: string | null; ultimoGenerado: string | null}): {desde: string; hasta: string} | null`
  - `claveTurno(fecha, turno, puesto): string`, `conflictos(turnos: Pick<FilaTurno, "fecha"|"turno"|"puesto"|"colaborador">[], ausencias: AusenciaRango[]): Map<string, string>`
  - `type DatosAusencia = Omit<Ausencia, "id">`, `validarAusencia(b: unknown): DatosAusencia | string` (string = mensaje de error)

- [ ] **Step 1: Escribir las pruebas que fallan** (agregar a `tests/horario.test.ts`; sumar estos nombres al `import` de `@/lib/horario`: `conflictos, claveTurno, hoyEnZona, mesesVisibles, rangoRegeneracion, ultimoDia, validarAusencia`)

```ts
describe("fechas", () => {
  test("hoyEnZona usa la hora de Caracas", () => {
    expect(hoyEnZona(new Date("2026-11-01T03:30:00Z"))).toBe("2026-10-31");
    expect(hoyEnZona(new Date("2026-11-01T04:30:00Z"))).toBe("2026-11-01");
  });
  test("ultimoDia", () => {
    expect(ultimoDia("2026-02")).toBe("2026-02-28");
    expect(ultimoDia("2026-12")).toBe("2026-12-31");
  });
});

describe("mesesVisibles", () => {
  const gen = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"];
  test("hoy 14/10 solo octubre aunque noviembre esté generado", () => {
    expect(mesesVisibles(2026, "2026-10-14", gen)).toEqual(["2026-10"]);
  });
  test("desde el 1/11 octubre y noviembre", () => {
    expect(mesesVisibles(2026, "2026-11-01", gen)).toEqual(["2026-10", "2026-11"]);
  });
  test("un año siguiente arranca en enero y no mezcla años", () => {
    expect(mesesVisibles(2027, "2027-02-03", gen)).toEqual(["2027-01", "2027-02"]);
  });
  test("años antes del inicio y meses no generados no aparecen", () => {
    expect(mesesVisibles(2025, "2026-10-14", gen)).toEqual([]);
    expect(mesesVisibles(2026, "2026-11-05", ["2026-10"])).toEqual(["2026-10"]);
  });
});

describe("rangoRegeneracion", () => {
  const ctx = { hoy: "2026-11-05", primerEstado: "2026-11-01", ultimoGenerado: "2026-12-31" };
  const a = (colaborador: string, inicio: string, retorno: string) => ({ colaborador, inicio, retorno });

  test("ausencia nueva futura regenera desde su inicio", () => {
    expect(rangoRegeneracion({ antes: null, despues: a("juan.salcedo", "2026-12-10", "2026-12-12") }, ctx))
      .toEqual({ desde: "2026-12-10", hasta: "2026-12-31" });
  });
  test("ausencia en curso regenera desde hoy", () => {
    expect(rangoRegeneracion({ antes: null, despues: a("juan.salcedo", "2026-11-01", "2026-11-20") }, ctx))
      .toEqual({ desde: "2026-11-05", hasta: "2026-12-31" });
  });
  test("ausencia que ya pasó no regenera", () => {
    expect(rangoRegeneracion({ antes: a("juan.salcedo", "2026-10-01", "2026-10-03"), despues: a("juan.salcedo", "2026-10-02", "2026-10-04") }, ctx))
      .toBeNull();
  });
  test("cambiar solo la nota no regenera", () => {
    const x = a("juan.salcedo", "2026-12-10", "2026-12-12");
    expect(rangoRegeneracion({ antes: x, despues: { ...x } }, ctx)).toBeNull();
  });
  test("persona informativa no regenera", () => {
    expect(rangoRegeneracion({ antes: null, despues: a("franklin.sanchez", "2026-12-01", "2026-12-07") }, ctx)).toBeNull();
  });
  test("mover una ausencia toma el inicio más temprano", () => {
    expect(rangoRegeneracion({ antes: a("juan.salcedo", "2026-12-20", "2026-12-22"), despues: a("juan.salcedo", "2026-12-10", "2026-12-12") }, ctx))
      .toEqual({ desde: "2026-12-10", hasta: "2026-12-31" });
  });
  test("sin meses generados o fuera del rango generado no regenera", () => {
    expect(rangoRegeneracion({ antes: null, despues: a("juan.salcedo", "2027-01-10", "2027-01-12") }, ctx)).toBeNull();
    expect(rangoRegeneracion({ antes: null, despues: a("juan.salcedo", "2026-12-10", "2026-12-12") }, { ...ctx, primerEstado: null, ultimoGenerado: null })).toBeNull();
  });
});

describe("conflictos", () => {
  const t = (fecha: string, turno: "manana" | "tarde", puesto: "pen_usd_mxn" | "clp", colaborador: string) => ({ fecha, turno, puesto, colaborador });
  test("marca turnos seguidos (tarde y mañana siguiente)", () => {
    const m = conflictos([t("2026-11-01", "tarde", "clp", "juan.salcedo"), t("2026-11-02", "manana", "pen_usd_mxn", "juan.salcedo")], []);
    expect(m.get(claveTurno("2026-11-01", "tarde", "clp"))).toBe("Tiene turnos seguidos");
    expect(m.get(claveTurno("2026-11-02", "manana", "pen_usd_mxn"))).toBe("Tiene turnos seguidos");
  });
  test("marca ausente y doble puesto", () => {
    const m = conflictos(
      [t("2026-11-03", "manana", "pen_usd_mxn", "angel.gomez"), t("2026-11-03", "manana", "clp", "angel.gomez")],
      [{ colaborador: "angel.gomez", inicio: "2026-11-03", retorno: "2026-11-04" }],
    );
    expect(m.get(claveTurno("2026-11-03", "manana", "clp"))).toBe("Está ausente ese día");
  });
  test("mañana y tarde de días distintos no choca", () => {
    const m = conflictos([t("2026-11-01", "manana", "clp", "juan.salcedo"), t("2026-11-02", "manana", "pen_usd_mxn", "juan.salcedo")], []);
    expect(m.size).toBe(0);
  });
});

describe("validarAusencia", () => {
  const ok = { colaborador: "juan.salcedo", tipo: "medica", inicio: "2026-11-10", retorno: "2026-11-11", nota: "  reposo  " };
  test("acepta y limpia la nota", () => {
    expect(validarAusencia(ok)).toEqual({ ...ok, nota: "reposo" });
  });
  test("rechaza datos inválidos", () => {
    expect(validarAusencia({ ...ok, colaborador: "otro" })).toBe("Colaborador inválido.");
    expect(validarAusencia({ ...ok, tipo: "x" })).toBe("Tipo de ausencia inválido.");
    expect(validarAusencia({ ...ok, inicio: "2026-02-30" })).toBe("Fechas inválidas.");
    expect(validarAusencia({ ...ok, retorno: "2026-11-10" })).toBe("El retorno debe ser posterior al inicio.");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/horario.test.ts`
Expected: FAIL — `hoyEnZona is not a function` (o similar por cada export faltante).

- [ ] **Step 3: Implementar (agregar al final de `lib/horario.ts`)**

```ts
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
  const inicio = afectadas.map((a) => a.inicio).sort()[0];
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
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/horario.test.ts`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add lib/horario.ts tests/horario.test.ts
git commit -m "feat(horarios): visibilidad del enlace, regeneración, avisos y validación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Esquema y repositorio en Postgres

**Files:**
- Create: `db/migraciones/002_horarios.sql`
- Create: `lib/horarioRepo.ts`

**Interfaces:**
- Consumes: tipos de Task 1; `sql` de `lib/db.ts`.
- Produces (todas aceptan `db: Db = sql` como último parámetro, `type Db = postgres.Sql | postgres.TransactionSql`):
  - `turnosEntre(desde, hasta): Promise<FilaTurno[]>`
  - `mesesGenerados(): Promise<string[]>`, `marcarMes(mes, por): Promise<void>`
  - `estadoEn(fecha): Promise<EstadoRotacion | null>`
  - `limitesHorario(): Promise<{primerEstado: string | null; ultimoGenerado: string | null}>`
  - `contarEditadas(desde, hasta): Promise<number>`
  - `guardarGeneracion(r: {turnos: FilaTurno[]; estados: EstadoDia[]}, desde, hasta): Promise<void>`
  - `editarTurno(f: {fecha; turno; puesto; colaborador}): Promise<number>` (filas afectadas)
  - `todasAusencias(): Promise<Ausencia[]>`, `ausenciasQueTocan(desde, hasta): Promise<Ausencia[]>`, `ausenciaPorId(id): Promise<Ausencia | null>`
  - `crearAusencia(a: DatosAusencia, por): Promise<void>`, `actualizarAusencia(id, a: DatosAusencia): Promise<void>`, `eliminarAusencia(id): Promise<void>`
  - `enlaceActivo(anio): Promise<string | null>`, `crearEnlace(anio, por): Promise<string>`, `enlacePorId(id): Promise<{anio: number; activo: boolean} | null>`

- [ ] **Step 1: Escribir la migración `db/migraciones/002_horarios.sql`**

```sql
-- Horarios de turnos de retiros internacionales (ver docs/superpowers/specs/2026-10-14-horarios-turnos-design.md).

create table ausencias (
  id          uuid primary key default gen_random_uuid(),
  colaborador text not null,
  tipo        text not null check (tipo in ('vacaciones', 'medica', 'otra')),
  inicio      date not null,
  retorno     date not null,              -- primer día de vuelta (exclusivo)
  nota        text not null default '',
  creado_el   timestamptz not null default now(),
  creado_por  text not null default '',
  check (retorno > inicio)
);
create index ausencias_rango on ausencias (inicio, retorno);

create table horario_turnos (
  fecha          date not null,
  turno          text not null check (turno in ('manana', 'tarde')),
  puesto         text not null check (puesto in ('pen_usd_mxn', 'clp')),
  colaborador    text not null,
  editado_manual boolean not null default false,
  primary key (fecha, turno, puesto)
);

-- Estado de la rotación al INICIO de cada día generado (y del día siguiente al último).
create table horario_estado (
  fecha  date primary key,
  estado jsonb not null
);

create table horario_meses (
  mes          text primary key check (mes ~ '^\d{4}-\d{2}$'),
  generado_el  timestamptz not null default now(),
  generado_por text not null default ''
);

create table horario_enlaces (
  id         text primary key,
  anio       integer not null,
  activo     boolean not null default true,
  creado_el  timestamptz not null default now(),
  creado_por text not null default ''
);
create unique index horario_enlaces_un_activo on horario_enlaces (anio) where activo;

-- Igual que 001: la API REST pública de Supabase no ve estas tablas.
alter table ausencias enable row level security;
alter table horario_turnos enable row level security;
alter table horario_estado enable row level security;
alter table horario_meses enable row level security;
alter table horario_enlaces enable row level security;
```

- [ ] **Step 2: Escribir `lib/horarioRepo.ts`**

```ts
import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import type {
  Ausencia,
  DatosAusencia,
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
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores. (No se corre la migración aquí: ver Task 9.)

- [ ] **Step 4: Commit**

```bash
git add db/migraciones/002_horarios.sql lib/horarioRepo.ts
git commit -m "feat(horarios): tablas y repositorio en Postgres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Servicio y rutas de administración

**Files:**
- Create: `lib/horarioServer.ts`
- Create: `app/api/horarios/route.ts`, `app/api/horarios/turno/route.ts`, `app/api/horarios/ausencias/route.ts`, `app/api/horarios/ausencias/[id]/route.ts`, `app/api/horarios/ausencias/impacto/route.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `requireAdmin`, `errorResponse`, `HttpError` de `lib/authServer.ts`.
- Produces (contratos HTTP que usa la UI de Task 7; todas las respuestas llevan `success`):
  - `GET /api/horarios?mes=YYYY-MM` → `{success, turnos: FilaTurno[], ausencias: Ausencia[], generados: string[], puedeGenerar: boolean}`
  - `POST /api/horarios` body `{mes}` → `{success}`; 409 si ya existe o falta el mes anterior; 422 si quedan < 5 personas
  - `PATCH /api/horarios/turno` body `{fecha, turno, puesto, colaborador}` → `{success}`
  - `GET /api/horarios/ausencias` → `{success, ausencias: Ausencia[]}`
  - `POST /api/horarios/ausencias` body `DatosAusencia & {confirmar?: boolean}` → `{success}`
  - `PATCH /api/horarios/ausencias/[id]` body `DatosAusencia & {confirmar?: boolean}`; `DELETE /api/horarios/ausencias/[id]?confirmar=1`
  - `POST /api/horarios/ausencias/impacto` body `{id?: string, ausencia?: DatosAusencia}` → `{success, editadas: number, desde: string | null, hasta: string | null}`

- [ ] **Step 1: Escribir `lib/horarioServer.ts`**

```ts
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
    const r = generarHorario(estado, desde, hasta, await repo.ausenciasQueTocan(desde, hasta, tx));
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
    const r = generarHorario(estado, rango.desde, rango.hasta, await repo.ausenciasQueTocan(rango.desde, rango.hasta, tx));
    if (!r.ok) throw new HttpError(422, `No se guardó: con este cambio ${sinCobertura(r.fechas)}`);
    await repo.guardarGeneracion(r, rango.desde, rango.hasta, tx);
  });
}
```

- [ ] **Step 2: Escribir `app/api/horarios/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { esMes, primerDia, ultimoDia } from "@/lib/horario";
import * as repo from "@/lib/horarioRepo";
import { generarMes } from "@/lib/horarioServer";

/** Turnos y ausencias de un mes, para la página de administración. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const mes = new URL(request.url).searchParams.get("mes");
    if (!esMes(mes)) throw new HttpError(400, "Mes inválido.");
    const [turnos, ausencias, generados, estadoInicial] = await Promise.all([
      repo.turnosEntre(primerDia(mes), ultimoDia(mes)),
      repo.ausenciasQueTocan(primerDia(mes), ultimoDia(mes)),
      repo.mesesGenerados(),
      repo.estadoEn(primerDia(mes)),
    ]);
    return NextResponse.json({
      success: true,
      turnos,
      ausencias,
      generados,
      puedeGenerar: !generados.includes(mes) && !!estadoInicial,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Genera el mes pedido. */
export async function POST(request: Request) {
  try {
    const s = await requireAdmin(request);
    const { mes } = (await request.json().catch(() => ({}))) as { mes?: unknown };
    if (!esMes(mes)) throw new HttpError(400, "Mes inválido.");
    await generarMes(mes, s.nombre || s.email);
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 3: Escribir `app/api/horarios/turno/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { esFecha, PUESTOS, ROTACION, TURNOS, type Puesto, type Turno } from "@/lib/horario";
import { editarTurno } from "@/lib/horarioRepo";

/** Cambia a mano quién cubre una casilla. */
export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { fecha, turno, puesto, colaborador } = b;
    if (!esFecha(fecha) || !TURNOS.includes(turno as Turno) || !PUESTOS.includes(puesto as Puesto))
      throw new HttpError(400, "Casilla inválida.");
    if (typeof colaborador !== "string" || !ROTACION.includes(colaborador))
      throw new HttpError(400, "Colaborador inválido.");
    const n = await editarTurno({ fecha, turno: turno as Turno, puesto: puesto as Puesto, colaborador });
    if (!n) throw new HttpError(404, "Ese día no está generado.");
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 4: Escribir `app/api/horarios/ausencias/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { validarAusencia } from "@/lib/horario";
import { crearAusencia, todasAusencias } from "@/lib/horarioRepo";
import { aplicarCambio } from "@/lib/horarioServer";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ success: true, ausencias: await todasAusencias() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const s = await requireAdmin(request);
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const datos = validarAusencia(b);
    if (typeof datos === "string") throw new HttpError(400, datos);
    await aplicarCambio({ antes: null, despues: datos }, b.confirmar === true, (tx) =>
      crearAusencia(datos, s.nombre || s.email, tx),
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 5: Escribir `app/api/horarios/ausencias/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { validarAusencia } from "@/lib/horario";
import { actualizarAusencia, ausenciaPorId, eliminarAusencia } from "@/lib/horarioRepo";
import { aplicarCambio } from "@/lib/horarioServer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cargar(params: Promise<{ id: string }>) {
  const { id } = await params;
  const antes = UUID.test(id) ? await ausenciaPorId(id) : null;
  if (!antes) throw new HttpError(404, "La ausencia no existe.");
  return antes;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const antes = await cargar(params);
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const datos = validarAusencia(b);
    if (typeof datos === "string") throw new HttpError(400, datos);
    await aplicarCambio({ antes, despues: datos }, b.confirmar === true, (tx) =>
      actualizarAusencia(antes.id, datos, tx),
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const antes = await cargar(params);
    const confirmar = new URL(request.url).searchParams.get("confirmar") === "1";
    await aplicarCambio({ antes, despues: null }, confirmar, (tx) => eliminarAusencia(antes.id, tx));
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 6: Escribir `app/api/horarios/ausencias/impacto/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { validarAusencia } from "@/lib/horario";
import { ausenciaPorId } from "@/lib/horarioRepo";
import { impactoCambio } from "@/lib/horarioServer";

/** Antes de guardar: cuántas casillas editadas a mano se perderían (crear: sin id; borrar: sin ausencia). */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const b = (await request.json().catch(() => ({}))) as { id?: unknown; ausencia?: unknown };
    const antes = typeof b.id === "string" ? await ausenciaPorId(b.id).catch(() => null) : null;
    if (typeof b.id === "string" && !antes) throw new HttpError(404, "La ausencia no existe.");
    let despues = null;
    if (b.ausencia !== undefined) {
      const d = validarAusencia(b.ausencia);
      if (typeof d === "string") throw new HttpError(400, d);
      despues = d;
    }
    const { rango, editadas } = await impactoCambio({ antes, despues });
    return NextResponse.json({ success: true, editadas, desde: rango?.desde ?? null, hasta: rango?.hasta ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 7: Verificar tipos, lint y pruebas**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; todas las pruebas pasan.

- [ ] **Step 8: Commit**

```bash
git add lib/horarioServer.ts app/api/horarios
git commit -m "feat(horarios): API de administración (generar, editar casilla, ausencias)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Enlace anual y API pública

**Files:**
- Create: `app/api/horarios/enlace/route.ts`
- Create: `app/api/horario-publico/[id]/route.ts`

**Interfaces:**
- Consumes: `enlaceActivo`, `crearEnlace`, `enlacePorId`, `mesesGenerados`, `turnosEntre`, `ausenciasQueTocan` (Task 3); `mesesVisibles`, `hoyEnZona`, `esMes` (Task 2).
- Produces:
  - `GET /api/horarios/enlace?anio=2026` → `{success, id}` (lo crea si no existe); `POST /api/horarios/enlace` body `{anio}` → `{success, id}` (reemplaza)
  - `GET /api/horario-publico/[id]?mes=YYYY-MM` →
    `{estado: "ok", anio, meses: string[], mes, turnos: {fecha, turno, puesto, colaborador}[], ausencias: {colaborador, tipo: "Vacaciones" | "Ausencia", inicio, retorno}[]}`
    | `{estado: "invalido"}` (404) | `{estado: "sin-meses", anio}` | `{estado: "no-disponible"}` (403) | `{estado: "error"}` (500)

- [ ] **Step 1: Escribir `app/api/horarios/enlace/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { crearEnlace, enlaceActivo } from "@/lib/horarioRepo";

const leerAnio = (v: unknown) => {
  const anio = Number(v);
  if (!Number.isInteger(anio) || anio < 2026 || anio > 2100) throw new HttpError(400, "Año inválido.");
  return anio;
};

/** Enlace activo del año; se crea la primera vez. */
export async function GET(request: Request) {
  try {
    const s = await requireAdmin(request);
    const anio = leerAnio(new URL(request.url).searchParams.get("anio"));
    const id = (await enlaceActivo(anio)) ?? (await crearEnlace(anio, s.nombre || s.email));
    return NextResponse.json({ success: true, id });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Reemplaza el enlace del año: el anterior deja de funcionar. */
export async function POST(request: Request) {
  try {
    const s = await requireAdmin(request);
    const { anio } = (await request.json().catch(() => ({}))) as { anio?: unknown };
    const id = await crearEnlace(leerAnio(anio), s.nombre || s.email);
    return NextResponse.json({ success: true, id });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 2: Escribir `app/api/horario-publico/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { esMes, hoyEnZona, mesesVisibles, primerDia, ultimoDia } from "@/lib/horario";
import { ausenciasQueTocan, enlacePorId, mesesGenerados, turnosEntre } from "@/lib/horarioRepo";

const sinCache = { headers: { "Cache-Control": "private, no-store" } };

/**
 * Horario para el enlace anual (sin login). Solo meses generados hasta el mes en curso
 * (hora de Caracas); cualquier otro se rechaza aunque exista. No expone notas ni el tipo
 * de ausencia más allá de "Vacaciones"/"Ausencia".
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id))
      return NextResponse.json({ estado: "invalido" }, { status: 404 });
    const enlace = await enlacePorId(id);
    if (!enlace?.activo) return NextResponse.json({ estado: "invalido" }, { status: 404 });

    const meses = mesesVisibles(enlace.anio, hoyEnZona(), await mesesGenerados());
    if (!meses.length) return NextResponse.json({ estado: "sin-meses", anio: enlace.anio }, sinCache);

    const pedido = new URL(request.url).searchParams.get("mes");
    if (pedido !== null && (!esMes(pedido) || !meses.includes(pedido)))
      return NextResponse.json({ estado: "no-disponible" }, { status: 403 });
    const mes = pedido ?? meses.at(-1)!;

    const [turnos, ausencias] = await Promise.all([
      turnosEntre(primerDia(mes), ultimoDia(mes)),
      ausenciasQueTocan(primerDia(mes), ultimoDia(mes)),
    ]);
    return NextResponse.json(
      {
        estado: "ok",
        anio: enlace.anio,
        meses,
        mes,
        turnos: turnos.map(({ fecha, turno, puesto, colaborador }) => ({ fecha, turno, puesto, colaborador })),
        ausencias: ausencias.map((a) => ({
          colaborador: a.colaborador,
          tipo: a.tipo === "vacaciones" ? "Vacaciones" : "Ausencia",
          inicio: a.inicio,
          retorno: a.retorno,
        })),
      },
      sinCache,
    );
  } catch (err) {
    console.error("Error armando horario público:", err);
    return NextResponse.json({ estado: "error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/api/horarios/enlace app/api/horario-publico
git commit -m "feat(horarios): enlace anual y API pública sin meses futuros

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Calendario compartido y visor público

**Files:**
- Create: `components/horarios/CalendarioMes.tsx`
- Create: `app/horario/[id]/page.tsx`
- Modify: `app/context/AuthContext.tsx:57-58`

**Interfaces:**
- Consumes: Task 1/2 (`diasDelMes`, `claveTurno`, `nombreCorto`, `fechaCorta`, `HORA_TURNO`, `ETIQUETA_TURNO`, `ETIQUETA_PUESTO`, `TURNOS`, `PUESTOS`); API pública de Task 5; `nombreMesAnio` de `components/reportes/fechas.ts`.
- Produces:
  - `CalendarioMes({mes, turnos, conflictos?, onEditar?})` — `turnos: {fecha; turno; puesto; colaborador; editadoManual?}[]`, `onEditar?: (c: {fecha; turno; puesto; colaborador}) => void`
  - `PieHorario({ausencias})` — `ausencias: {colaborador; tipo: string; inicio; retorno}[]`

- [ ] **Step 1: Escribir `components/horarios/CalendarioMes.tsx`**

```tsx
"use client";

import { AlertTriangle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardClass } from "@/components/dashboard/CardHeading";
import {
  ETIQUETA_PUESTO,
  ETIQUETA_TURNO,
  HORA_TURNO,
  PUESTOS,
  TURNOS,
  claveTurno,
  diasDelMes,
  fechaCorta,
  nombreCorto,
  type Puesto,
  type Turno,
} from "@/lib/horario";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
/** 0 = lunes … 6 = domingo */
const diaSemana = (fecha: string) => (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7;

export type Casilla = { fecha: string; turno: Turno; puesto: Puesto; colaborador: string };

/** Calendario del mes con el formato del Excel: cada día con Mañana y Tarde, PEN/USD/MXN y CLP. */
export function CalendarioMes({
  mes,
  turnos,
  conflictos,
  onEditar,
}: {
  mes: string;
  turnos: (Casilla & { editadoManual?: boolean })[];
  conflictos?: Map<string, string>;
  onEditar?: (c: Casilla) => void;
}) {
  const porClave = new Map(turnos.map((t) => [claveTurno(t.fecha, t.turno, t.puesto), t]));
  const dias = diasDelMes(mes);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {DIAS.map((d) => (
        <div key={d} className="hidden px-1 text-xs font-medium text-muted-foreground lg:block">
          {d}
        </div>
      ))}
      {Array.from({ length: diaSemana(dias[0]) }, (_, i) => (
        <div key={`vacio-${i}`} className="hidden lg:block" />
      ))}
      {dias.map((fecha) => (
        <div key={fecha} className="rounded-lg border border-border bg-card p-2 text-xs">
          <div className="mb-1.5 font-semibold">
            {DIAS[diaSemana(fecha)]} {Number(fecha.slice(8))}
          </div>
          {TURNOS.map((turno) => (
            <div key={turno} className="mb-1 last:mb-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {ETIQUETA_TURNO[turno]}
              </div>
              {PUESTOS.map((puesto) => {
                const clave = claveTurno(fecha, turno, puesto);
                const t = porClave.get(clave);
                const aviso = conflictos?.get(clave);
                const clase = cn(
                  "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left",
                  puesto === "clp" ? "bg-muted/60" : "bg-primary/10",
                  aviso && "ring-1 ring-warning-text",
                );
                const contenido = (
                  <>
                    <span className="truncate">{t ? nombreCorto(t.colaborador) : "—"}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {ETIQUETA_PUESTO[puesto]}
                    </span>
                    {t?.editadoManual && (
                      <Pencil className="size-3 shrink-0 text-muted-foreground" aria-label="Editado a mano" />
                    )}
                    {aviso && <AlertTriangle className="size-3 shrink-0 text-warning-text" aria-label={aviso} />}
                  </>
                );
                return onEditar && t ? (
                  <button
                    key={puesto}
                    type="button"
                    title={aviso}
                    className={cn(clase, "hover:bg-accent")}
                    onClick={() => onEditar({ fecha, turno, puesto, colaborador: t.colaborador })}
                  >
                    {contenido}
                  </button>
                ) : (
                  <div key={puesto} title={aviso} className={clase}>
                    {contenido}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Pie del calendario: horario de cada turno y ausencias del mes, como en el Excel. */
export function PieHorario({
  ausencias,
}: {
  ausencias: { colaborador: string; tipo: string; inicio: string; retorno: string }[];
}) {
  return (
    <div className={cn(cardClass, "grid gap-4 text-sm sm:grid-cols-2")}>
      <div>
        <div className="mb-1 font-semibold">Horario</div>
        {TURNOS.map((t) => (
          <div key={t}>
            {ETIQUETA_TURNO[t]}: {HORA_TURNO[t]}
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 font-semibold">Ausencias del mes</div>
        {ausencias.length === 0 && <div className="text-muted-foreground">Ninguna</div>}
        {ausencias.map((a) => (
          <div key={`${a.colaborador}-${a.inicio}`}>
            {nombreCorto(a.colaborador)} · {a.tipo} · del {fechaCorta(a.inicio)}, vuelve el {fechaCorta(a.retorno)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Escribir `app/horario/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvisoExpediente } from "@/components/expediente/Expediente";
import { CalendarioMes, PieHorario, type Casilla } from "@/components/horarios/CalendarioMes";
import { nombreMesAnio } from "@/components/reportes/fechas";

type Respuesta =
  | {
      estado: "ok";
      anio: number;
      meses: string[];
      mes: string;
      turnos: Casilla[];
      ausencias: { colaborador: string; tipo: string; inicio: string; retorno: string }[];
    }
  | { estado: "invalido" | "no-disponible" | "error" }
  | { estado: "sin-meses"; anio: number };

/** Enlace anual que reciben los colaboradores: solo el horario, sin sidebar ni login. */
export default function VisorHorario() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [mes, setMes] = useState<string | null>(null);
  const [res, setRes] = useState<{ clave: string; r: Respuesta } | null>(null);
  const clave = `${id}|${mes ?? ""}`;

  useEffect(() => {
    let cancelado = false;
    const q = mes ? `?mes=${mes}` : "";
    fetch(`/api/horario-publico/${encodeURIComponent(id)}${q}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<Respuesta>)
      .catch((): Respuesta => ({ estado: "error" }))
      .then((r) => !cancelado && setRes({ clave, r }));
    return () => {
      cancelado = true;
    };
  }, [id, mes, clave]);

  const r = res?.clave === clave ? res.r : null;

  let contenido: React.ReactNode;
  if (!r) {
    contenido = <Skeleton className="h-[480px] rounded-xl" aria-hidden />;
  } else if (r.estado === "ok") {
    contenido = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Horario · {nombreMesAnio(r.mes)}</h1>
          <Select value={r.mes} onValueChange={setMes}>
            <SelectTrigger className="w-[190px]" aria-label="Mes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {r.meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {nombreMesAnio(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CalendarioMes mes={r.mes} turnos={r.turnos} />
        <PieHorario ausencias={r.ausencias} />
      </div>
    );
  } else {
    const avisos: Record<string, [string, string]> = {
      invalido: ["Enlace no válido", "Este enlace no es válido o fue reemplazado. Pide el nuevo a tu supervisor."],
      "sin-meses": ["Aún no hay horario", "Todavía no hay un horario publicado para este año."],
      "no-disponible": ["Mes no disponible", "Ese mes todavía no está disponible."],
      error: ["No se pudo cargar", "Hubo un problema al cargar el horario. Inténtalo de nuevo más tarde."],
    };
    const [titulo, texto] = avisos[r.estado] ?? avisos.error;
    contenido = <AvisoExpediente titulo={titulo} texto={texto} />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-sidebar">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2.5 px-4 py-3 md:px-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-auto w-7" />
          <span className="font-bold tracking-tight">PayoutMetrics</span>
          <span className="text-[13px] text-muted-foreground">· Horario de turnos</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-7">{contenido}</main>
    </div>
  );
}
```

> Antes de escribir, abrir `app/evaluacion-operador/[id]/page.tsx` y confirmar que `AvisoExpediente` se exporta desde `components/expediente/Expediente` con props `{titulo, texto}` (así lo usa ese visor).

- [ ] **Step 3: Marcar `/horario/` como ruta pública en `app/context/AuthContext.tsx`**

Reemplazar:

```ts
  const isPublicRoute =
    pathname === "/login" || pathname.startsWith("/evaluacion-operador");
```

por:

```ts
  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/evaluacion-operador") ||
    pathname.startsWith("/horario/"); // "/horarios" (admin) no entra: lleva la barra
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/horarios/CalendarioMes.tsx app/horario app/context/AuthContext.tsx
git commit -m "feat(horarios): calendario y visor público del enlace anual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Página de administración

**Files:**
- Create: `components/horarios/EditarTurnoDialog.tsx`, `components/horarios/AusenciasTab.tsx`, `components/horarios/EnlaceTab.tsx`
- Create: `app/(dashboard)/horarios/page.tsx`
- Modify: `components/Sidebar.tsx` (imports de lucide y grupo `operaciones`)

**Interfaces:**
- Consumes: rutas de Tasks 4–5 vía `apiFetch`; `CalendarioMes`, `PieHorario`, `Casilla` (Task 6); `ConfirmDialog` de `components/usuarios/ConfirmDialog.tsx` (props `open, onOpenChange, titulo, descripcion, accion, tono, onConfirmar`).
- Produces: página `/horarios` (solo admin).

- [ ] **Step 1: Escribir `components/horarios/EditarTurnoDialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { ETIQUETA_PUESTO, ETIQUETA_TURNO, ROTACION, fechaCorta, nombreCorto } from "@/lib/horario";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Casilla } from "./CalendarioMes";

/** Cambia a mano quién cubre una casilla. */
export function EditarTurnoDialog({
  casilla,
  onCerrar,
  onGuardado,
}: {
  casilla: Casilla | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const valor = elegido ?? casilla?.colaborador ?? "";

  const guardar = async () => {
    if (!casilla) return;
    setGuardando(true);
    try {
      await apiFetch("/api/horarios/turno", { method: "PATCH", body: JSON.stringify({ ...casilla, colaborador: valor }) });
      toast.success("Turno actualizado");
      setElegido(null);
      onGuardado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={!!casilla}
      onOpenChange={(o) => {
        if (!o) {
          setElegido(null);
          onCerrar();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar turno</DialogTitle>
          <DialogDescription>
            {casilla &&
              `${fechaCorta(casilla.fecha)} · ${ETIQUETA_TURNO[casilla.turno]} · ${ETIQUETA_PUESTO[casilla.puesto]}`}
          </DialogDescription>
        </DialogHeader>
        <Select value={valor} onValueChange={setElegido}>
          <SelectTrigger aria-label="Colaborador">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROTACION.map((c) => (
              <SelectItem key={c} value={c}>
                {nombreCorto(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || valor === casilla?.colaborador}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> Confirmar en `components/ui/dialog.tsx` que existen `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` (shadcn estándar). Si falta alguno, usar el que exista con el mismo propósito.

- [ ] **Step 2: Escribir `components/horarios/AusenciasTab.tsx`**

```tsx
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

const VACIA: DatosAusencia = { colaborador: COLABORADORES[0], tipo: "vacaciones", inicio: "", retorno: "", nota: "" };

type Pendiente = { editadas: number; ejecutar: (confirmar: boolean) => Promise<void> };

/** Alta, edición y baja de ausencias. Si el cambio borraría ediciones manuales, pide confirmación. */
export function AusenciasTab({ onCambio }: { onCambio: () => void }) {
  const [lista, setLista] = useState<Ausencia[] | null>(null);
  const [form, setForm] = useState<{ id?: string; datos: DatosAusencia } | null>(null);
  const [borrando, setBorrando] = useState<Ausencia | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLista((await apiFetch<{ ausencias: Ausencia[] }>("/api/horarios/ausencias")).ausencias);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las ausencias.");
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

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
      await cargar();
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
                  <Input id="aus-inicio" type="date" value={form.datos.inicio} onChange={(e) => set("inicio", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="aus-retorno">Vuelve el</Label>
                  <Input id="aus-retorno" type="date" value={form.datos.retorno} onChange={(e) => set("retorno", e.target.value)} />
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
```

- [ ] **Step 3: Escribir `components/horarios/EnlaceTab.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/dashboard/CardHeading";
import { ConfirmDialog } from "@/components/usuarios/ConfirmDialog";

const copiar = async (id: string, anio: number) => {
  await navigator.clipboard.writeText(`${window.location.origin}/horario/${id}`);
  toast.success(`Enlace ${anio} copiado`, { description: "Muestra los meses hasta el mes en curso." });
};

/** Enlace anual que se comparte con los colaboradores. */
export function EnlaceTab({ anio }: { anio: number }) {
  const [reemplazando, setReemplazando] = useState(false);

  const copiarActual = async () => {
    try {
      const { id } = await apiFetch<{ id: string }>(`/api/horarios/enlace?anio=${anio}`);
      await copiar(id, anio);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo copiar el enlace.");
    }
  };

  return (
    <div className={cn(cardClass, "flex flex-col gap-3")}>
      <h2 className="font-semibold">Enlace {anio}</h2>
      <p className="text-sm text-muted-foreground">
        Un solo enlace para todo el año. Los colaboradores ven los meses generados hasta el mes en curso; nunca meses futuros.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copiarActual}>
          <Copy className="size-4" /> Copiar enlace {anio}
        </Button>
        <Button variant="outline" onClick={() => setReemplazando(true)}>
          <RefreshCw className="size-4" /> Reemplazar enlace
        </Button>
      </div>
      <ConfirmDialog
        open={reemplazando}
        onOpenChange={setReemplazando}
        titulo="Reemplazar enlace"
        descripcion="El enlace actual deja de funcionar. Tendrás que enviar el nuevo a todos."
        accion="Reemplazar"
        tono="danger"
        onConfirmar={async () => {
          try {
            const { id } = await apiFetch<{ id: string }>("/api/horarios/enlace", {
              method: "POST",
              body: JSON.stringify({ anio }),
            });
            await copiar(id, anio);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo reemplazar el enlace.");
            throw err;
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Escribir `app/(dashboard)/horarios/page.tsx`**

```tsx
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
```

> Confirmar en `components/ui/toggle-group.tsx` que `ToggleGroup` acepta `type="single"`, `variant` y `onValueChange` (lo usa `components/usuarios/UsersTable.tsx`); copiar exactamente cómo se usa allí.

- [ ] **Step 5: Agregar la entrada al menú en `components/Sidebar.tsx`**

En el import de `lucide-react` agregar `CalendarClock`. En el grupo `operaciones`, después de "Evaluación diaria":

```ts
      { label: "Horarios", icon: CalendarClock, href: "/horarios", requireAdmin: true },
```

- [ ] **Step 6: Verificar tipos, lint, pruebas y build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: sin errores; el build lista `/horarios`, `/horario/[id]` y las rutas `/api/horarios/*`, `/api/horario-publico/[id]`.

- [ ] **Step 7: Commit**

```bash
git add components/horarios "app/(dashboard)/horarios" components/Sidebar.tsx
git commit -m "feat(horarios): página de administración (horario, ausencias, enlace)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Script de importación del Excel

**Files:**
- Create: `scripts/importar-horario-excel.mts`
- Modify: `package.json` (script `horario:importar`)

**Interfaces:**
- Consumes: `generarHorario`, `estaAusente`, `type FilaTurno`, `type DatosAusencia` (Task 1/2); `guardarGeneracion`, `marcarMes`, `crearAusencia`, `mesesGenerados` (Task 3); `sql` (`lib/db.ts`).
- Produces: `npm run horario:importar -- "Horario 2026.xlsx"` (modo prueba por defecto; escribe solo con `--escribir`).

- [ ] **Step 1: Escribir `scripts/importar-horario-excel.mts`**

```ts
// Importa UNA vez octubre 2026 y las vacaciones de "Horario 2026.xlsx" al horario en Postgres.
// Sin --escribir solo valida y muestra el resumen. Se niega si ya hay meses en el sistema.
import * as XLSX from "xlsx";
import { sql } from "@/lib/db";
import { generarHorario, type DatosAusencia, type EstadoRotacion, type FilaTurno } from "@/lib/horario";
import { crearAusencia, guardarGeneracion, marcarMes, mesesGenerados } from "@/lib/horarioRepo";

const archivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
const escribir = process.argv.includes("--escribir");
if (!archivo) {
  console.error('Uso: npm run horario:importar -- "Horario 2026.xlsx" [--escribir]');
  process.exit(1);
}

const CORTOS: Record<string, string> = {
  "Rafael B.": "rafael.benitez", "Angel A.": "angel.aleman", "Juan S.": "juan.salcedo",
  "Shirley P.": "shirley.perez", "Shirley P": "shirley.perez", "Angel G.": "angel.gomez",
  "Gabriel A.": "gabriel.amariscua",
};
const COMPLETOS: Record<string, string> = {
  "Rafael Benitez": "rafael.benitez", "Angel Aleman": "angel.aleman", "Juan Salcedo": "juan.salcedo",
  "Shirley Pérez": "shirley.perez", "Angel Gomez": "angel.gomez", "Gabriel Amariscua": "gabriel.amariscua",
};
/** Estado al 01/11/2026 (verificado en tests/horario.test.ts contra el 01/11 del Excel). */
const ESTADO_1_NOV: EstadoRotacion = {
  orden: ["juan.salcedo", "shirley.perez", "rafael.benitez", "angel.gomez", "angel.aleman"],
  pos: 4,
  invertido: false,
  contador: 0,
};
/** Ausencias que el Excel anota solo al pie de cada mes. */
const EXTRA: DatosAusencia[] = [
  { colaborador: "gabriel.amariscua", tipo: "vacaciones", inicio: "2026-10-13", retorno: "2026-11-02", nota: "Importada del Excel" },
  { colaborador: "franklin.sanchez", tipo: "vacaciones", inicio: "2026-11-09", retorno: "2026-12-07", nota: "Importada del Excel (informativa)" },
];

const wb = XLSX.readFile(archivo);

/** Turnos de una hoja mensual: cada día tiene debajo mañana PEN, mañana CLP, tarde PEN, tarde CLP. */
function turnosDeHoja(hoja: string, mes: string): FilaTurno[] {
  const filas = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[hoja], { header: 1, defval: "", raw: false });
  const out: FilaTurno[] = [];
  const orden = [["manana", "pen_usd_mxn"], ["manana", "clp"], ["tarde", "pen_usd_mxn"], ["tarde", "clp"]] as const;
  filas.forEach((fila, r) =>
    fila.forEach((celda, c) => {
      const m = String(celda).match(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo) (\d\d)$/);
      if (!m) return;
      orden.forEach(([turno, puesto], k) => {
        const texto = String(filas[r + 1 + k]?.[c] ?? "").trim();
        const nombre = texto.match(/^(.+?)\s*\((PEN\/USD\/MXN|CLP)\)$/)?.[1].trim() ?? "";
        const colaborador = CORTOS[nombre];
        if (!colaborador) throw new Error(`${hoja} ${m[2]}: no reconozco "${texto}"`);
        out.push({ fecha: `${mes}-${m[2]}`, turno, puesto, colaborador, editadoManual: false });
      });
    }),
  );
  return out;
}

/** "14/09/2026" → "2026-09-14" */
const iso = (s: string) => {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error(`Fecha no reconocida: "${s}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
};

function vacaciones(): DatosAusencia[] {
  const filas = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Vacaciones"], { header: 1, defval: "", raw: false });
  return filas
    .filter((f) => COMPLETOS[String(f[0]).trim()]) // columnas: Nombre, Inicio, Retorno
    .map((f) => ({
      colaborador: COMPLETOS[String(f[0]).trim()],
      tipo: "vacaciones" as const,
      inicio: iso(String(f[1])),
      retorno: iso(String(f[2])),
      nota: "Importada del Excel",
    }));
}

const octubre = turnosDeHoja("Octubre", "2026-10");
if (octubre.length !== 31 * 4) throw new Error(`Octubre debería tener 124 casillas y tiene ${octubre.length}`);
const ausencias = [...vacaciones(), ...EXTRA];

// El estado del 01/11 debe reproducir el 01/11 del Excel.
const nov = turnosDeHoja("Noviembre", "2026-11").filter((t) => t.fecha === "2026-11-01");
const prueba = generarHorario(ESTADO_1_NOV, "2026-11-01", "2026-11-01", ausencias);
if (!prueba.ok) throw new Error("El estado del 01/11 no genera");
const firma = (ts: FilaTurno[]) => ts.map((t) => `${t.turno}|${t.puesto}|${t.colaborador}`).sort().join(",");
if (firma(prueba.turnos) !== firma(nov)) throw new Error("El estado del 01/11 no coincide con el Excel");

console.log(`Octubre: ${octubre.length} casillas. Ausencias: ${ausencias.length}.`);
for (const a of ausencias) console.log(`  ${a.colaborador} ${a.inicio} → ${a.retorno}`);

if (!escribir) {
  console.log("Modo prueba: no se escribió nada. Agrega --escribir para importar.");
} else {
  await sql.begin(async (tx) => {
    if ((await mesesGenerados(tx)).length) throw new Error("Ya hay meses en el sistema: la importación es solo para el arranque.");
    await guardarGeneracion(
      { turnos: octubre, estados: [{ fecha: "2026-11-01", estado: ESTADO_1_NOV }] },
      "2026-10-01",
      "2026-10-31",
      tx,
    );
    await marcarMes("2026-10", "Importado del Excel", tx);
    for (const a of ausencias) await crearAusencia(a, "Importado del Excel", tx);
  });
  console.log("Importación completa.");
}
await sql.end();
```

> Ojo: `guardarGeneracion` borra `horario_estado` desde `2026-10-01` y luego inserta solo el del 01/11. Es lo esperado: octubre importado no tiene estado (no se regenera; se ajusta a mano).

- [ ] **Step 2: Agregar el script en `package.json`** (junto a los `db:*`)

```json
    "horario:importar": "tsx --env-file=.env.local scripts/importar-horario-excel.mts"
```

- [ ] **Step 3: Probar en modo prueba (solo lee el Excel y valida; `sql` no se usa sin `--escribir`, pero `lib/db.ts` necesita `DATABASE_URL` para cargar)**

Run: `npm run horario:importar -- "Horario 2026.xlsx"`
Expected: `Octubre: 124 casillas. Ausencias: 8.` (6 de la hoja + 2 extra), la lista de ausencias y `Modo prueba: no se escribió nada.`

- [ ] **Step 4: Commit**

```bash
git add scripts/importar-horario-excel.mts package.json
git commit -m "feat(horarios): importación única de octubre y vacaciones desde el Excel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificación final y guía de despliegue

**Files:**
- Create: `new_views/deploy-horarios.md`

- [ ] **Step 1: Verificación completa**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: todo en verde. Si algo falla, corregir antes de seguir.

- [ ] **Step 2: Escribir `new_views/deploy-horarios.md`**

```markdown
# Deploy: horarios de turnos

Orden obligatorio (las tablas deben existir antes de publicar el código):

1. `npm run db:esquema` — aplica `002_horarios.sql` (solo crea tablas nuevas; no toca retiros).
2. `npm run horario:importar -- "Horario 2026.xlsx"` — revisar el resumen.
3. `npm run horario:importar -- "Horario 2026.xlsx" --escribir` — importa octubre, el estado del 01/11 y las ausencias. Se niega si ya hay meses.
4. Merge de `feature/horarios` a `main` → Vercel publica.
5. En `/horarios`: ver octubre, ir a noviembre y pulsar "Generar mes". Revisar y ajustar casillas.
6. Pestaña Enlace → "Copiar enlace 2026" y enviarlo. Hoy muestra solo octubre; noviembre aparece el 01/11 (hora de Caracas).

Rollback: revertir el merge. Las tablas nuevas pueden quedar; no afectan al resto.
```

- [ ] **Step 3: Commit**

```bash
git add new_views/deploy-horarios.md
git commit -m "docs(horarios): guía de despliegue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Pedir confirmación al usuario antes de tocar producción**

Los pasos 1–3 de la guía escriben en la base de producción. **No ejecutarlos sin un "sí" explícito del usuario.** Tras su confirmación, correrlos y probar la API con `next start` + `fetch` a `127.0.0.1` en una sola llamada de Bash (el navegador/curl no llegan al dev server desde las herramientas):
- `GET /api/horario-publico/<id>` → `estado: "ok"`, `meses: ["2026-10"]`
- `GET /api/horario-publico/<id>?mes=2026-11` → 403 `no-disponible`
```
