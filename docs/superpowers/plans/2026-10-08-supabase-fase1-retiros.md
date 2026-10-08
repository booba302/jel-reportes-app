# Migración a Supabase — Fase 1: retiros — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar los retiros (`operaciones_retiros`, `historial_reportes`, `observaciones_diarias`) de Firestore a Postgres en Supabase, para que cada vista reciba resultados ya agregados en vez de miles de documentos.

**Architecture:** Mixto. Firebase Auth sigue igual; el navegador nunca habla con Postgres. Las rutas `/api/*` validan el token (`requireUser`), consultan Postgres con `postgres` (postgres.js) y devuelven a cada vista lo que ya consume hoy. Las agregaciones pesadas se hacen con `GROUP BY` en SQL y producen "celdas" (grupos de retiros iguales con `n` y sumas); las funciones puras actuales del dashboard y del monitor pasan a sumar celdas en vez de retiros sueltos, así la lógica de negocio sigue en un solo lugar.

**Tech Stack:** Next.js 16 (App Router, route handlers), Postgres 17 en Supabase (us-west-2), `postgres` 3.x, Firebase Admin, Vitest, tsx.

**Spec:** Decisiones tomadas en la conversación del 2026-10-08 (no hay documento aparte):
- Enfoque mixto: Auth y `usuarios`/`auditoria_usuarios` se quedan en Firebase.
- Esta fase migra solo lo que toca retiros. `evaluaciones_desempeno`, `evaluaciones_mensuales`, `configuracion` y `enlaces_expedientes` quedan en Firestore para una Fase 2 (son ~2.000 documentos y no causan la lentitud).
- Funciones de Vercel en `pdx1` (Oregón) para quedar junto a Supabase: `vercel.json` ya creado en esta rama.
- Volumen medido: 447.717 retiros (ene–oct 2026, ~48.000/mes), 1.291 historiales, 174 observaciones.

## Global Constraints

- El navegador nunca importa `lib/db.ts` ni se conecta a Postgres. Toda lectura/escritura de estas tres tablas pasa por `/api/*` con `requireUser` (o `requireAdmin`).
- La app usa `DATABASE_URL` (transaction pooler, puerto 6543) con `prepare: false`. Los scripts usan `DIRECT_URL` (session pooler, puerto 5432).
- Las columnas `date` y `timestamptz` se leen en SQL como texto (`::text`) o se convierten con `.toISOString()`; nunca se compara un `Date` de JS contra un día.
- Reglas de negocio idénticas a las de hoy: Autopago (`Operador === "Autopago"`) y exonerados quedan fuera de SLA y tiempo; exonerado = `comentarioBrecha` con algún carácter no blanco; VIP = `Nivel` (sin espacios al borde) en `Nivel 2`, `Nivel 3`, `Nivel 4`.
- Las respuestas de la API mantienen las formas que ya usan los componentes (`HistorialReporte`, `OperacionRow`, `Vista`, `OpMonitor`, `RetiroOperador`). Los componentes visuales no cambian.
- Moneda: una moneda real solo si está en `getMonedasByRol(rol)`; `GLOBAL` solo para admin y solo en lecturas.
- Next 16: antes de escribir una ruta nueva, leer `node_modules/next/dist/docs/` (route handlers) y copiar la forma de las rutas existentes (`export async function GET(request: Request)`; los params dinámicos son `Promise`).
- Textos de UI y errores en español, con el tono de los mensajes existentes.

## Review Focus

1. **Recargar un día ya auditado no debe borrar exoneraciones.** El upsert de retiros nunca toca `comentario_brecha` (hoy Firestore hace `merge`). Lo prueba `scripts/probar-upsert.mts` (Tarea 3).
2. **Caché vieja del monitor en `sessionStorage`.** Las tuplas guardadas antes no traen `n`; leerlas daría `NaN`. La clave cambia a `monitor2:` (Tarea 8) y hay un test de ida y vuelta de la tupla.
3. **Documentos con fecha de reporte inválida o ausente.** No deben romper la copia: se descartan y se cuentan en el resumen (tests del mapeo, Tarea 2).
4. **Un agente pide una moneda de otro grupo o `GLOBAL`.** Debe recibir 403, no datos (tests de `exigirMoneda`, Tarea 4).
5. **Valores sucios en Firestore:** `Tiempo` como texto o `NaN`, `Cumple` ausente, `Nivel` con espacios, `Operador` vacío. Deben mapear igual que hoy (tests del mapeo, Tarea 2; columnas generadas, Tarea 1).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `db/migraciones/001_retiros.sql` | Esquema: 3 tablas, columnas generadas, índices, RLS |
| `lib/db.ts` | Conexión única a Postgres para las rutas |
| `lib/retirosFila.ts` | Mapeo puro documento Firestore / carga → fila SQL |
| `lib/retirosRepo.ts` | Escrituras compartidas (guardar reporte, retiros de un operador) |
| `lib/monedasServer.ts` | `exigirMoneda` (permisos por moneda) |
| `lib/dashboard.ts` | Cálculos puros del dashboard sobre celdas (movidos desde el hook) |
| `lib/monitor.ts` | `OpMonitor` pasa a ser celda (`n`) |
| `app/api/reportes/mes`, `app/api/reportes/dia` | Historial del mes y SLA de un día |
| `app/api/auditoria`, `.../comentario`, `.../nota` | Auditoría diaria |
| `app/api/dashboard`, `app/api/monitor` | Vistas agregadas |
| `app/api/evaluacion/retiros-dia`, `app/api/expediente/retiros` | Datos para evaluación y expediente |
| `scripts/aplicar-sql.mts`, `scripts/copiar-firestore.mts`, `scripts/verificar-copia.mts`, `scripts/probar-upsert.mts` | Esquema, copia, verificación |
| `tests/*.test.ts` | Vitest |

Se borran: `app/api/cerrar-mes`, `app/api/sincronizar-evaluaciones`, `app/api/reportes/route.ts` (Drive), `services/googleDrive.ts`, `app/(dashboard)/gestor-reportes`, `app/(dashboard)/cargar-reportes`. Nada los llama: las páginas no están en el menú (las reemplazó `/reportes`) y las rutas no tienen ningún `fetch` que las use.

---

### Task 1: Base de datos, conexión y herramientas

**Files:**
- Create: `db/migraciones/001_retiros.sql`, `lib/db.ts`, `scripts/aplicar-sql.mts`, `vitest.config.mts`, `tests/humo.test.ts`
- Modify: `package.json`
- Commit también: `vercel.json` (ya existe)

**Interfaces:**
- Produces: `sql` (instancia `postgres.Sql`) exportada desde `@/lib/db`; tablas `retiros`, `historial_reportes`, `observaciones_diarias`; `npm test`, `npm run db:esquema`.

- [ ] **Step 1: Instalar herramientas**

```bash
npm install -D vitest tsx
```
(`postgres` ya quedó instalado al crear la rama.)

- [ ] **Step 2: Scripts en `package.json`**

Agregar a `"scripts"`:
```json
"test": "vitest run",
"db:esquema": "tsx --env-file=.env.local scripts/aplicar-sql.mts",
"db:copiar": "tsx --env-file=.env.local scripts/copiar-firestore.mts",
"db:verificar": "tsx --env-file=.env.local scripts/verificar-copia.mts",
"db:probar-upsert": "tsx --env-file=.env.local scripts/probar-upsert.mts"
```

- [ ] **Step 3: `vitest.config.mts`**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Test de humo y correrlo**

`tests/humo.test.ts`:
```ts
import { expect, test } from "vitest";
import { VIP_LEVELS } from "@/lib/constants";

test("vitest resuelve el alias @", () => {
  expect(VIP_LEVELS).toContain("Nivel 2");
});
```
Run: `npm test` → Expected: 1 passed.

- [ ] **Step 5: Esquema `db/migraciones/001_retiros.sql`**

```sql
-- Retiros: un registro por operación. El id es el mismo de Firestore
-- (MONEDA_JUGADOR_TIMESTAMP), así recargar un día actualiza en vez de duplicar.
create table retiros (
  id                text primary key,
  fecha_reporte     date not null,
  moneda            text not null,
  operador          text not null,
  jugador           text not null default '',
  alias             text not null default '',
  cantidad          double precision not null default 0,
  nivel             text not null default '',
  fecha_operacion   text not null default '',  -- tal como vino: "2026-03-01 14:35:00"
  update_date       text not null default '',
  hora              smallint,                  -- hora de fecha_operacion; null si no tiene
  tiempo            double precision not null default 0,
  cumple            boolean not null default false,
  comentario_brecha text not null default '',  -- solo lo escribe la auditoría
  autopago  boolean generated always as (operador = 'Autopago') stored,
  exonerado boolean generated always as (comentario_brecha ~ '\S') stored,
  vip       boolean generated always as (btrim(nivel, E' \t\r\n') in ('Nivel 2', 'Nivel 3', 'Nivel 4')) stored
);
create index retiros_fecha_moneda on retiros (fecha_reporte, moneda);
create index retiros_moneda_fecha on retiros (moneda, fecha_reporte);
create index retiros_operador_fecha on retiros (operador, fecha_reporte);

create table historial_reportes (
  id              text primary key,            -- MONEDA_YYYY-MM-DD
  fecha_reporte   date not null,
  moneda          text not null,
  subido_el       timestamptz not null,
  subido_por      text not null default '',
  total_registros integer not null default 0
);
create index historial_moneda_fecha on historial_reportes (moneda, fecha_reporte);

create table observaciones_diarias (
  moneda              text not null,
  fecha               date not null,
  observacion         text not null default '',
  fecha_actualizacion timestamptz not null default now(),
  primary key (moneda, fecha)
);

-- La API REST pública de Supabase no debe ver estas tablas: RLS sin políticas
-- la bloquea. La app entra como dueña de las tablas, que no está sujeta a RLS.
alter table retiros enable row level security;
alter table historial_reportes enable row level security;
alter table observaciones_diarias enable row level security;
```

- [ ] **Step 6: `scripts/aplicar-sql.mts`**

```ts
// Aplica en orden los .sql de db/migraciones que aún no se aplicaron.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
const dir = path.join(process.cwd(), "db", "migraciones");

await sql`create table if not exists _migraciones (nombre text primary key, aplicada_el timestamptz not null default now())`;
await sql`alter table _migraciones enable row level security`;
const hechas = new Set((await sql`select nombre from _migraciones`).map((r) => r.nombre as string));

for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (hechas.has(archivo)) continue;
  await sql.begin(async (tx) => {
    await tx.unsafe(fs.readFileSync(path.join(dir, archivo), "utf8"));
    await tx`insert into _migraciones (nombre) values (${archivo})`;
  });
  console.log("aplicada:", archivo);
}
console.log("Esquema al día.");
await sql.end();
```

- [ ] **Step 7: Aplicar y comprobar**

Run: `npm run db:esquema` → Expected: `aplicada: 001_retiros.sql` y `Esquema al día.`
Run de nuevo → Expected: solo `Esquema al día.` (idempotente).

- [ ] **Step 8: `lib/db.ts`**

```ts
import postgres from "postgres";

// Una sola conexión por proceso. En desarrollo Next recarga módulos, por eso se guarda en globalThis.
const g = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  g.sql ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false, // obligatorio con el transaction pooler de Supabase (puerto 6543)
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") g.sql = sql;
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.mts tests/humo.test.ts db lib/db.ts scripts/aplicar-sql.mts vercel.json
git commit -m "feat(db): esquema de retiros en Supabase y herramientas de prueba"
```

---

### Task 2: Mapeo de documentos a filas

**Files:**
- Create: `lib/retirosFila.ts`, `tests/retirosFila.test.ts`

**Interfaces:**
- Produces:
  - `type FilaRetiro = { id; fecha_reporte: string /* YYYY-MM-DD */; moneda; operador; jugador; alias; cantidad: number; nivel; fecha_operacion; update_date; hora: number | null; tiempo: number; cumple: boolean; comentario_brecha?: string }`
  - `type FilaHistorial = { id; fecha_reporte; moneda; subido_el: string /* ISO */; subido_por; total_registros: number }`
  - `type FilaObservacion = { moneda; fecha; observacion; fecha_actualizacion: string }`
  - `diaDeReporte(v: unknown): string | null`, `horaDe(s: string): number | null`
  - `filaRetiro(id, datos): FilaRetiro | null`, `filaHistorial(id, datos): FilaHistorial | null`, `filaObservacion(id, datos): FilaObservacion | null`

- [ ] **Step 1: Tests que fallan — `tests/retirosFila.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { diaDeReporte, filaHistorial, filaObservacion, filaRetiro, horaDe } from "@/lib/retirosFila";

const base = {
  "Fecha de la operación": "2026-03-01 14:35:00",
  Jugador: 123456,
  Alias: "pepe",
  Cantidad: 15000,
  Nivel: "Nivel 2",
  "Update date": "2026-03-01 14:50:00",
  Tiempo: 15,
  Cumple: true,
  Moneda: "CLP",
  "Fecha del reporte": "2026-03-01T00:00:00.000Z",
  Operador: "Ana Pérez",
};

describe("diaDeReporte", () => {
  test("acepta ISO y día suelto", () => {
    expect(diaDeReporte("2026-03-01T00:00:00.000Z")).toBe("2026-03-01");
    expect(diaDeReporte("2026-03-01")).toBe("2026-03-01");
  });
  test("rechaza vacíos y fechas imposibles", () => {
    expect(diaDeReporte(undefined)).toBeNull();
    expect(diaDeReporte("")).toBeNull();
    expect(diaDeReporte("2026-02-30T00:00:00.000Z")).toBeNull();
    expect(diaDeReporte("01-03-2026")).toBeNull();
  });
});

describe("horaDe", () => {
  test("toma la hora de 'YYYY-MM-DD HH:mm:ss'", () => {
    expect(horaDe("2026-03-01 14:35:00")).toBe(14);
    expect(horaDe("2026-03-01 07:05:00")).toBe(7);
  });
  test("null si no hay hora", () => {
    expect(horaDe("2026-03-01")).toBeNull();
    expect(horaDe("")).toBeNull();
  });
});

describe("filaRetiro", () => {
  test("mapea un documento completo", () => {
    expect(filaRetiro("CLP_123456_20260301143500", base)).toEqual({
      id: "CLP_123456_20260301143500",
      fecha_reporte: "2026-03-01",
      moneda: "CLP",
      operador: "Ana Pérez",
      jugador: "123456",
      alias: "pepe",
      cantidad: 15000,
      nivel: "Nivel 2",
      fecha_operacion: "2026-03-01 14:35:00",
      update_date: "2026-03-01 14:50:00",
      hora: 14,
      tiempo: 15,
      cumple: true,
    });
  });
  test("valores sucios se normalizan como hoy", () => {
    const f = filaRetiro("x", { ...base, Tiempo: "abc", Cumple: undefined, Operador: "", Cantidad: null })!;
    expect(f.tiempo).toBe(0);
    expect(f.cumple).toBe(false);
    expect(f.operador).toBe("Desconocido");
    expect(f.cantidad).toBe(0);
  });
  test("Tiempo numérico en texto se respeta", () => {
    expect(filaRetiro("x", { ...base, Tiempo: "31.5" })!.tiempo).toBe(31.5);
  });
  test("sin fecha de reporte válida → null", () => {
    expect(filaRetiro("x", { ...base, "Fecha del reporte": undefined })).toBeNull();
  });
  test("no incluye comentario_brecha (lo escribe solo la auditoría)", () => {
    expect(filaRetiro("x", { ...base, comentarioBrecha: "Falla banco" })).not.toHaveProperty("comentario_brecha");
  });
});

describe("filaHistorial", () => {
  test("mapea y valida", () => {
    expect(
      filaHistorial("CLP_2026-03-01", {
        fechaReporte: "2026-03-01T00:00:00.000Z",
        moneda: "CLP",
        subidoEl: "2026-03-02T10:00:00.000Z",
        subidoPor: "Ana",
        totalRegistros: 1500,
      }),
    ).toEqual({
      id: "CLP_2026-03-01",
      fecha_reporte: "2026-03-01",
      moneda: "CLP",
      subido_el: "2026-03-02T10:00:00.000Z",
      subido_por: "Ana",
      total_registros: 1500,
    });
  });
  test("subidoEl inválido → época, sin romper", () => {
    expect(filaHistorial("x", { fechaReporte: "2026-03-01T00:00:00.000Z", subidoEl: "ayer" })!.subido_el).toBe(
      "1970-01-01T00:00:00.000Z",
    );
  });
});

describe("filaObservacion", () => {
  test("separa moneda y día del id", () => {
    expect(
      filaObservacion("VES_2026-09-14", { observacion: "Caída del banco", fechaActualizacion: "2026-09-14T22:00:00.000Z" }),
    ).toEqual({ moneda: "VES", fecha: "2026-09-14", observacion: "Caída del banco", fecha_actualizacion: "2026-09-14T22:00:00.000Z" });
  });
  test("id que no calza → null", () => {
    expect(filaObservacion("basura", {})).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm test` → Expected: FAIL, `Cannot find module '@/lib/retirosFila'`.

- [ ] **Step 3: Implementar `lib/retirosFila.ts`**

```ts
/** Mapeo puro de documentos de Firestore (o filas de una carga) a filas de Postgres. */

export type FilaRetiro = {
  id: string;
  fecha_reporte: string; // YYYY-MM-DD
  moneda: string;
  operador: string;
  jugador: string;
  alias: string;
  cantidad: number;
  nivel: string;
  fecha_operacion: string;
  update_date: string;
  hora: number | null;
  tiempo: number;
  cumple: boolean;
  /** Solo lo trae la copia desde Firestore; las cargas nunca lo pisan. */
  comentario_brecha?: string;
};

export type FilaHistorial = {
  id: string;
  fecha_reporte: string;
  moneda: string;
  subido_el: string; // ISO
  subido_por: string;
  total_registros: number;
};

export type FilaObservacion = {
  moneda: string;
  fecha: string;
  observacion: string;
  fecha_actualizacion: string;
};

const EPOCA = new Date(0).toISOString();

const esDia = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00.000Z`).toISOString().startsWith(s);

const isoOEpoca = (v: unknown) => {
  const t = Date.parse(String(v ?? ""));
  return Number.isNaN(t) ? EPOCA : new Date(t).toISOString();
};

/** "2026-03-01T00:00:00.000Z" o "2026-03-01" → "2026-03-01"; null si no es un día real. */
export function diaDeReporte(v: unknown): string | null {
  const s = String(v ?? "").split("T")[0];
  return esDia(s) ? s : null;
}

/** Hora (0–23) de "2026-03-01 14:35:00"; null si no tiene. Misma regla que usaba el monitor. */
export function horaDe(fechaOperacion: string): number | null {
  const parte = fechaOperacion.split(" ")[1];
  if (!parte) return null;
  const h = Number(parte.slice(0, 2));
  return Number.isFinite(h) ? h : null;
}

/** Documento de `operaciones_retiros` (o `datos` de una carga) → fila. null si no tiene fecha de reporte válida. */
export function filaRetiro(id: string, d: Record<string, unknown>): FilaRetiro | null {
  const fecha = diaDeReporte(d["Fecha del reporte"]);
  if (!fecha) return null;
  const fechaOperacion = String(d["Fecha de la operación"] ?? "");
  return {
    id,
    fecha_reporte: fecha,
    moneda: String(d.Moneda ?? ""),
    operador: String(d.Operador || "Desconocido"),
    jugador: String(d.Jugador ?? ""),
    alias: String(d.Alias ?? ""),
    cantidad: Number(d.Cantidad) || 0,
    nivel: String(d.Nivel ?? ""),
    fecha_operacion: fechaOperacion,
    update_date: String(d["Update date"] ?? ""),
    hora: horaDe(fechaOperacion),
    tiempo: Number(d.Tiempo) || 0,
    cumple: d.Cumple === true,
  };
}

export function filaHistorial(id: string, d: Record<string, unknown>): FilaHistorial | null {
  const fecha = diaDeReporte(d.fechaReporte);
  if (!fecha) return null;
  return {
    id,
    fecha_reporte: fecha,
    moneda: String(d.moneda ?? ""),
    subido_el: isoOEpoca(d.subidoEl),
    subido_por: String(d.subidoPor ?? ""),
    total_registros: Number(d.totalRegistros) || 0,
  };
}

/** El id de `observaciones_diarias` es "MONEDA_YYYY-MM-DD". */
export function filaObservacion(id: string, d: Record<string, unknown>): FilaObservacion | null {
  const m = id.match(/^([A-Z]+)_(\d{4}-\d{2}-\d{2})$/);
  if (!m || !esDia(m[2])) return null;
  return {
    moneda: m[1],
    fecha: m[2],
    observacion: String(d.observacion ?? ""),
    fecha_actualizacion: isoOEpoca(d.fechaActualizacion),
  };
}
```

Nota: `horaDe("2026-03-01 ")` daba `0` con la regla vieja (`Number("")`); con esta da `null`. Es un caso que no ocurre con los formatos reales y `null` es más correcto.

- [ ] **Step 4: Correr tests**

Run: `npm test` → Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/retirosFila.ts tests/retirosFila.test.ts
git commit -m "feat(db): mapeo de retiros, historial y observaciones a filas SQL"
```

---

### Task 3: Repositorio de escritura y copia desde Firestore

**Files:**
- Create: `lib/retirosRepo.ts`, `scripts/copiar-firestore.mts`, `scripts/verificar-copia.mts`, `scripts/probar-upsert.mts`

**Interfaces:**
- Consumes: `sql` (`@/lib/db`), tipos y mapeos de `@/lib/retirosFila`.
- Produces:
  - `guardarRetiros(filas: FilaRetiro[], db?: postgres.Sql, conComentario?: boolean): Promise<void>`
  - `guardarHistorial(filas: FilaHistorial[], db?: postgres.Sql): Promise<void>`
  - `guardarObservaciones(filas: FilaObservacion[], db?: postgres.Sql): Promise<void>`
  - `guardarReporte(retiros: FilaRetiro[], historial: FilaHistorial[]): Promise<void>` (transacción)
  - `retirosDeOperador(operador: string, desde: string, hasta: string): Promise<RetiroOperador[]>`

- [ ] **Step 1: `lib/retirosRepo.ts`**

```ts
import type postgres from "postgres";
import { sql } from "@/lib/db";
import type { RetiroOperador } from "@/lib/expediente";
import type { FilaHistorial, FilaObservacion, FilaRetiro } from "@/lib/retirosFila";

const LOTE = 2000; // 2000 filas × 14 columnas, lejos del límite de 65.535 parámetros

const COLUMNAS = [
  "id", "fecha_reporte", "moneda", "operador", "jugador", "alias", "cantidad",
  "nivel", "fecha_operacion", "update_date", "hora", "tiempo", "cumple",
] as const satisfies readonly (keyof FilaRetiro)[];

/**
 * Inserta o actualiza retiros. Al actualizar NUNCA toca comentario_brecha:
 * recargar un día ya auditado conserva sus exoneraciones (igual que el merge de Firestore).
 * `conComentario` solo lo usa la copia inicial, que inserta en tablas vacías.
 */
export async function guardarRetiros(filas: FilaRetiro[], db: postgres.Sql = sql, conComentario = false) {
  const cols: (keyof FilaRetiro)[] = conComentario ? [...COLUMNAS, "comentario_brecha"] : [...COLUMNAS];
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await db`
      insert into retiros ${db(lote, cols)}
      on conflict (id) do update set
        fecha_reporte = excluded.fecha_reporte, moneda = excluded.moneda,
        operador = excluded.operador, jugador = excluded.jugador, alias = excluded.alias,
        cantidad = excluded.cantidad, nivel = excluded.nivel,
        fecha_operacion = excluded.fecha_operacion, update_date = excluded.update_date,
        hora = excluded.hora, tiempo = excluded.tiempo, cumple = excluded.cumple`;
  }
}

export async function guardarHistorial(filas: FilaHistorial[], db: postgres.Sql = sql) {
  for (let i = 0; i < filas.length; i += LOTE) {
    await db`
      insert into historial_reportes ${db(filas.slice(i, i + LOTE))}
      on conflict (id) do update set
        fecha_reporte = excluded.fecha_reporte, moneda = excluded.moneda,
        subido_el = excluded.subido_el, subido_por = excluded.subido_por,
        total_registros = excluded.total_registros`;
  }
}

export async function guardarObservaciones(filas: FilaObservacion[], db: postgres.Sql = sql) {
  for (let i = 0; i < filas.length; i += LOTE) {
    await db`
      insert into observaciones_diarias ${db(filas.slice(i, i + LOTE))}
      on conflict (moneda, fecha) do update set
        observacion = excluded.observacion, fecha_actualizacion = excluded.fecha_actualizacion`;
  }
}

/** Retiros + historial de una carga, todo o nada. */
export async function guardarReporte(retiros: FilaRetiro[], historial: FilaHistorial[]) {
  await sql.begin(async (tx) => {
    await guardarRetiros(retiros, tx);
    await guardarHistorial(historial, tx);
  });
}

/** Retiros de un operador con fecha de reporte en [desde, hasta] (acepta ISO o YYYY-MM-DD). */
export async function retirosDeOperador(operador: string, desde: string, hasta: string): Promise<RetiroOperador[]> {
  const filas = await sql`
    select moneda, cumple, comentario_brecha
    from retiros
    where operador = ${operador}
      and fecha_reporte between ${desde.slice(0, 10)}::date and ${hasta.slice(0, 10)}::date`;
  return filas.map((r) => ({ Moneda: r.moneda, Cumple: r.cumple, comentarioBrecha: r.comentario_brecha }));
}
```

Si TypeScript rechaza `tx` como `postgres.Sql` en `guardarReporte`, tipar el parámetro como `postgres.Sql | postgres.TransactionSql` en las tres funciones.

- [ ] **Step 2: Probar que el upsert respeta exoneraciones — `scripts/probar-upsert.mts`**

```ts
// Inserta un retiro de prueba con comentario, lo "recarga" y comprueba que el comentario sigue.
import postgres from "postgres";
import { guardarRetiros } from "@/lib/retirosRepo";
import type { FilaRetiro } from "@/lib/retirosFila";

const db = postgres(process.env.DIRECT_URL!, { max: 1 });
const fila: FilaRetiro = {
  id: "PRUEBA_UPSERT", fecha_reporte: "2000-01-01", moneda: "CLP", operador: "Prueba",
  jugador: "", alias: "", cantidad: 0, nivel: "", fecha_operacion: "2000-01-01 10:00:00",
  update_date: "", hora: 10, tiempo: 40, cumple: false,
};
try {
  await guardarRetiros([{ ...fila, comentario_brecha: "Falla banco" }], db, true);
  await guardarRetiros([{ ...fila, tiempo: 41 }], db); // recarga del día, sin comentario
  const [r] = await db`select tiempo, comentario_brecha, exonerado from retiros where id = 'PRUEBA_UPSERT'`;
  if (r.comentario_brecha !== "Falla banco" || r.exonerado !== true || r.tiempo !== 41) {
    console.error("FALLA:", r);
    process.exitCode = 1;
  } else console.log("OK: la recarga actualizó el tiempo y conservó la exoneración.");
} finally {
  await db`delete from retiros where id = 'PRUEBA_UPSERT'`;
  await db.end();
}
```
Run: `npm run db:probar-upsert` → Expected: `OK: la recarga actualizó el tiempo y conservó la exoneración.`

- [ ] **Step 3: `scripts/copiar-firestore.mts`**

```ts
// Copia completa de Firestore → Postgres. VACÍA las tres tablas antes de copiar:
// se puede correr las veces que haga falta y el resultado es siempre una foto fiel.
import postgres from "postgres";
import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { filaHistorial, filaObservacion, filaRetiro, type FilaRetiro } from "@/lib/retirosFila";
import { guardarHistorial, guardarObservaciones, guardarRetiros } from "@/lib/retirosRepo";

const db = postgres(process.env.DIRECT_URL!, { max: 2 });
const PAGINA = 5000;

async function* paginas(coleccion: string) {
  let ultimo: QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = adminDb.collection(coleccion).orderBy(FieldPath.documentId()).limit(PAGINA);
    if (ultimo) q = q.startAfter(ultimo);
    const snap = await q.get();
    if (snap.empty) return;
    yield snap.docs;
    ultimo = snap.docs[snap.docs.length - 1];
  }
}

async function copiar<T>(
  coleccion: string,
  mapear: (id: string, d: Record<string, unknown>) => T | null,
  guardar: (filas: T[]) => Promise<void>,
) {
  let leidos = 0, copiados = 0;
  const descartados: string[] = [];
  for await (const docs of paginas(coleccion)) {
    const filas: T[] = [];
    for (const d of docs) {
      const f = mapear(d.id, d.data());
      if (f) filas.push(f);
      else descartados.push(d.id);
    }
    await guardar(filas);
    leidos += docs.length;
    copiados += filas.length;
    process.stdout.write(`\r${coleccion}: ${copiados} de ${leidos}`);
  }
  console.log(`\n${coleccion}: ${copiados} copiados, ${descartados.length} descartados`);
  if (descartados.length) console.log("  descartados (primeros 20):", descartados.slice(0, 20).join(", "));
}

try {
  const t0 = Date.now();
  await db`truncate retiros, historial_reportes, observaciones_diarias`;
  await copiar(
    "operaciones_retiros",
    (id, d): FilaRetiro | null => {
      const f = filaRetiro(id, d);
      return f && { ...f, comentario_brecha: String(d.comentarioBrecha ?? "") };
    },
    (filas) => guardarRetiros(filas, db, true),
  );
  await copiar("historial_reportes", filaHistorial, (f) => guardarHistorial(f, db));
  await copiar("observaciones_diarias", filaObservacion, (f) => guardarObservaciones(f, db));
  console.log(`Listo en ${Math.round((Date.now() - t0) / 1000)} s.`);
} finally {
  await db.end();
}
process.exit(0); // firebase-admin deja conexiones abiertas
```

- [ ] **Step 4: Correr la copia**

Run: `npm run db:copiar` (unos minutos; lee ~450.000 documentos, cuesta ~USD 0,30 en lecturas de Firestore)
Expected: `operaciones_retiros: 447717 copiados, 0 descartados` (o cerca: anotar los descartados y revisar a mano un par de ids en la consola de Firebase), `historial_reportes: 1291…`, `observaciones_diarias: 174…`.

- [ ] **Step 5: `scripts/verificar-copia.mts`**

```ts
// Compara por mes: cantidad de retiros y suma de Tiempo en Firestore vs Postgres.
import postgres from "postgres";
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const db = postgres(process.env.DIRECT_URL!, { max: 1 });
const meses = (await db`
  select to_char(fecha_reporte, 'YYYY-MM') as mes, count(*)::int as n, sum(tiempo)::float8 as tiempo
  from retiros group by 1 order by 1`) as unknown as { mes: string; n: number; tiempo: number }[];

let fallas = 0;
for (const m of meses) {
  const [y, mm] = m.mes.split("-").map(Number);
  const siguiente = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 7);
  const agg = await adminDb
    .collection("operaciones_retiros")
    .where("Fecha del reporte", ">=", `${m.mes}-01T00:00:00.000Z`)
    .where("Fecha del reporte", "<", `${siguiente}-01T00:00:00.000Z`)
    .aggregate({ n: AggregateField.count(), tiempo: AggregateField.sum("Tiempo") })
    .get();
  const fs = agg.data();
  const ok = fs.n === m.n && Math.abs((fs.tiempo ?? 0) - m.tiempo) < 0.01 * Math.max(1, m.n);
  if (!ok) fallas++;
  console.log(`${m.mes}  firestore ${fs.n} / ${(fs.tiempo ?? 0).toFixed(1)}  postgres ${m.n} / ${m.tiempo.toFixed(1)}  ${ok ? "OK" : "DIFERENCIA"}`);
}
const [h] = await db`select count(*)::int as n from historial_reportes`;
const [o] = await db`select count(*)::int as n from observaciones_diarias`;
const hFs = (await adminDb.collection("historial_reportes").count().get()).data().count;
const oFs = (await adminDb.collection("observaciones_diarias").count().get()).data().count;
console.log(`historial ${hFs} / ${h.n}   observaciones ${oFs} / ${o.n}`);
if (hFs !== h.n || oFs !== o.n) fallas++;
console.log(fallas ? `${fallas} diferencias` : "Todo coincide.");
await db.end();
process.exit(fallas ? 1 : 0);
```

`sum("Tiempo")` de Firestore ignora valores que no son número; si un mes da DIFERENCIA solo en el tiempo y la cantidad coincide, revisar si hay `Tiempo` guardados como texto antes de dar la copia por mala.

- [ ] **Step 6: Verificar**

Run: `npm run db:verificar` → Expected: todas las filas `OK` y `Todo coincide.`

- [ ] **Step 7: Commit**

```bash
git add lib/retirosRepo.ts scripts/copiar-firestore.mts scripts/verificar-copia.mts scripts/probar-upsert.mts
git commit -m "feat(db): repositorio de retiros y copia verificada desde Firestore"
```

---

### Task 4: Permisos por moneda y rutas de escritura

**Files:**
- Create: `lib/monedasServer.ts`, `tests/monedasServer.test.ts`
- Modify: `app/api/upload-reporte/route.ts`, `app/api/fetch-api-reporte/route.ts`, `app/api/delete-reporte/route.ts`, `components/reportes/useCargaReporte.ts`
- Delete: `app/api/cerrar-mes/`, `app/api/sincronizar-evaluaciones/`, `app/api/reportes/route.ts`, `services/googleDrive.ts`, `app/(dashboard)/gestor-reportes/`, `app/(dashboard)/cargar-reportes/`

**Interfaces:**
- Consumes: `guardarReporte`, `filaRetiro`, `diaDeReporte`, `sql`.
- Produces: `exigirMoneda(yo: Sesion, moneda: string, opciones?: { global?: boolean }): void` (lanza `HttpError(403)`). `/api/fetch-api-reporte` ahora guarda y responde `{ success, message, monedaGuardada, totalRegistros }` (ya no devuelve `operaciones` ni `historial`).

- [ ] **Step 1: Tests que fallan — `tests/monedasServer.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { exigirMoneda } from "@/lib/monedasServer";

const yo = (rol: string) => ({ uid: "u", nombre: "N", email: "e", rol });

describe("exigirMoneda", () => {
  test("agente internacional: sus monedas sí, VES no", () => {
    expect(() => exigirMoneda(yo("agente_retiros_internacional"), "CLP")).not.toThrow();
    expect(() => exigirMoneda(yo("agente_retiros_internacional"), "VES")).toThrow(/acceso/);
  });
  test("agente nacional: solo VES", () => {
    expect(() => exigirMoneda(yo("agente_retiros_nacional"), "VES")).not.toThrow();
    expect(() => exigirMoneda(yo("agente_retiros_nacional"), "PEN")).toThrow();
  });
  test("GLOBAL: solo admin y solo si la ruta lo permite", () => {
    expect(() => exigirMoneda(yo("admin"), "GLOBAL", { global: true })).not.toThrow();
    expect(() => exigirMoneda(yo("admin"), "GLOBAL")).toThrow();
    expect(() => exigirMoneda(yo("agente_retiros_internacional"), "GLOBAL", { global: true })).toThrow();
  });
  test("moneda inventada → 403", () => {
    expect(() => exigirMoneda(yo("admin"), "EUR")).toThrow();
  });
});
```
Run: `npm test` → Expected: FAIL (módulo no existe).

- [ ] **Step 2: `lib/monedasServer.ts`**

```ts
import { HttpError, type Sesion } from "@/lib/authServer";
import { getMonedasByRol, parseUserRole } from "@/lib/roles";

/**
 * Lanza 403 si quien llama no puede ver o tocar esa moneda.
 * GLOBAL (todas) solo vale en lecturas que lo admiten y solo para admin.
 */
export function exigirMoneda(yo: Sesion, moneda: string, { global = false } = {}) {
  if (moneda === "GLOBAL") {
    if (global && parseUserRole(yo.rol).isAdmin) return;
    throw new HttpError(403, "Solo un administrador puede ver todas las monedas.");
  }
  if (!getMonedasByRol(yo.rol).includes(moneda))
    throw new HttpError(403, "No tienes acceso a esa moneda.");
}
```
Run: `npm test` → Expected: PASS.

- [ ] **Step 3: `upload-reporte` guarda en Postgres**

En `app/api/upload-reporte/route.ts`:
1. Quitar `import { adminDb } from "@/lib/firebaseAdmin";` y agregar:
```ts
import { exigirMoneda } from "@/lib/monedasServer";
import { guardarReporte } from "@/lib/retirosRepo";
import { filaRetiro, type FilaHistorial, type FilaRetiro } from "@/lib/retirosFila";
```
2. Quitar el parámetro `rol` de `transformarFila` (no se usa) y la variable `const rol = yo.rol;`.
3. Justo después de leer `currency`: `exigirMoneda(yo, currency);` (el `try` externo ya devuelve 500 genérico; envolver así para responder 403):
```ts
try {
  exigirMoneda(yo, currency);
} catch (e) {
  return errorResponse(e);
}
```
4. Reemplazar desde `const operacionesRef = …` hasta el último `await batchHistorial.commit();` por:
```ts
    const filas: FilaRetiro[] = [];
    const historiales: FilaHistorial[] = [];
    const fechasProcesadas = Object.keys(reportesAgrupados);

    for (const [dateStr, filasDeLaFecha] of Object.entries(reportesAgrupados)) {
      const transformadas = filasDeLaFecha.map((fila) => transformarFila(fila, currency, dateStr));
      for (const t of transformadas) {
        const f = filaRetiro(t.idUnico, t.datos);
        if (f) filas.push(f);
      }
      const dia = dateStr.slice(0, 10);
      historiales.push({
        id: `${currency}_${dia}`,
        fecha_reporte: dia,
        moneda: currency,
        subido_el: new Date().toISOString(),
        subido_por: subidoPor || "Sistema",
        total_registros: transformadas.length,
      });
    }

    await guardarReporte(filas, historiales);
```
5. En la respuesta, usar `filas.length` donde decía `todasLasOperacionesNuevas.length`.

- [ ] **Step 4: `fetch-api-reporte` guarda en el servidor**

En `app/api/fetch-api-reporte/route.ts`:
1. Imports: `exigirMoneda`, `guardarReporte`, `filaRetiro`, `type FilaRetiro`.
2. Tras validar `fecha`: mismo bloque `try { exigirMoneda(yo, currency); } catch (e) { return errorResponse(e); }`.
3. Reemplazar el bloque final (desde `if (todasLasOperacionesNuevas.length === 0)` hasta el `return NextResponse.json({ success: true, … operaciones, historial })`) por:
```ts
    const filas = todasLasOperacionesNuevas
      .map((o) => filaRetiro(o.idUnico, o.datos))
      .filter((f): f is FilaRetiro => f !== null);

    if (filas.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No se encontraron operaciones para ${currency} en esta fecha.`,
        totalRegistros: 0,
      });
    }

    await guardarReporte(filas, [
      {
        id: `${currency}_${fecha}`,
        fecha_reporte: fecha,
        moneda: currency,
        subido_el: new Date().toISOString(),
        subido_por: subidoPor || "Extracción API",
        total_registros: filas.length,
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `Extracción completada. Se guardaron ${filas.length} operaciones.`,
      monedaGuardada: currency,
      totalRegistros: filas.length,
    });
```

- [ ] **Step 5: `useCargaReporte` deja de escribir en Firestore**

En `components/reportes/useCargaReporte.ts`:
1. Borrar los imports de `firebase/firestore` y `@/lib/firebase`, el tipo `Operacion` y la función `guardarEnFirestore`.
2. En `sincronizar`, reemplazar desde `const operaciones: Operacion[] = …` hasta `terminar(d, operaciones.length);` por:
```ts
        // El servidor ya guardó el día al responder.
        const total = Number(json.totalRegistros) || 0;
        if (total === 0) {
          setFalla({
            titulo: "El API no devolvió retiros",
            descripcion: `El API no devolvió retiros para el ${diaCorto(d)}. Puedes intentar de nuevo o cargar el archivo Excel de ese día.`,
          });
          setFase("falla");
          return;
        }
        terminar(d, total);
```
La fase `"guardando"` queda en el tipo `FaseCarga` porque `CargaReporteDialog` la nombra; ya no se usa. Si el usuario cancela mientras el servidor guarda, el día puede quedar cargado igual; al recargar el mes se ve como cargado (aceptable, no deja datos a medias porque `guardarReporte` es una transacción).

- [ ] **Step 6: `delete-reporte` borra en Postgres**

Reemplazar el cuerpo del segundo `try` de `app/api/delete-reporte/route.ts`:
```ts
    const { searchParams } = new URL(request.url);
    const dia = diaDeReporte(searchParams.get("fecha"));
    const moneda = searchParams.get("moneda") ?? "";
    const idHistorial = searchParams.get("id");

    if (!dia || !moneda || !idHistorial) {
      return NextResponse.json({ success: false, error: "Faltan parámetros" }, { status: 400 });
    }
    exigirMoneda(yo, moneda);

    const borrados = await sql.begin(async (tx) => {
      const r = await tx`delete from retiros where fecha_reporte = ${dia}::date and moneda = ${moneda}`;
      await tx`delete from historial_reportes where id = ${idHistorial}`;
      return r.count;
    });

    return NextResponse.json({
      success: true,
      message: `Reporte eliminado. Se borraron ${borrados} registros.`,
    });
```
Cambiar `await requireUser(request);` por `yo = await requireUser(request);` (declarar `let yo: Sesion;` como en las otras rutas), y en el `catch` final devolver `errorResponse(error)` para que el 403 de `exigirMoneda` llegue tal cual. Imports: `sql`, `diaDeReporte`, `exigirMoneda`, `type Sesion`; quitar `adminDb`.

- [ ] **Step 7: Borrar lo que ya no se usa**

```bash
git rm -r "app/api/cerrar-mes" "app/api/sincronizar-evaluaciones" "app/api/reportes/route.ts" "services/googleDrive.ts" "app/(dashboard)/gestor-reportes" "app/(dashboard)/cargar-reportes"
```
Luego `grep -rn "googleapis" app components lib` → si no hay resultados: `npm uninstall googleapis`.
Revisar `components/MainLayout.tsx` (`BREADCRUMBS`) y quitar las entradas de `/gestor-reportes` y `/cargar-reportes` si existen.

- [ ] **Step 8: Verificar**

Run: `npm test` → PASS. Run: `npx tsc --noEmit` → sin errores. Run: `npm run build` → compila.
Manual (con `npm run dev`, entra con un usuario internacional):
- `/reportes` → en un día ya cargado, borrar el reporte → toast "Reporte eliminado. Se borraron N registros." Volver a cargarlo por API → toast "Reporte del … cargado".
- En Supabase (Table editor → `retiros`) el día tiene filas; si alguna estaba exonerada antes de borrar, se perdió (borrar sí borra). Para probar la conservación, recargar un día **sin** borrarlo y comprobar en `/auditoria-diaria` (Tarea 6) que sus exoneraciones siguen.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(reportes): cargas y borrado de reportes en Postgres; quita rutas y páginas sin uso"
```

---

### Task 5: Lectura de reportes (calendario y SLA del día)

**Files:**
- Create: `app/api/reportes/mes/route.ts`, `app/api/reportes/dia/route.ts`
- Modify: `components/reportes/useReportesMes.ts`, `components/reportes/useDiaDetalle.ts`

**Interfaces:**
- Consumes: `sql`, `exigirMoneda`, `apiFetch`.
- Produces: `GET /api/reportes/mes?moneda&mes` → `{ historial: HistorialReporte[] }`; `GET /api/reportes/dia?moneda&fecha` → `{ sla: number; exonerados: number }`.

- [ ] **Step 1: `app/api/reportes/mes/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";

/** Historial de cargas de una moneda en un mes ("2026-10"). */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const moneda = searchParams.get("moneda") ?? "";
    const mes = searchParams.get("mes") ?? "";
    exigirMoneda(yo, moneda, { global: true });
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, "Mes inválido.");

    const filas = await sql`
      select id, fecha_reporte::text as fecha, moneda, subido_el, subido_por, total_registros
      from historial_reportes
      where moneda = ${moneda}
        and fecha_reporte >= ${`${mes}-01`}::date
        and fecha_reporte < ${`${mes}-01`}::date + interval '1 month'
      order by fecha_reporte`;

    const historial = filas.map((f) => ({
      id: f.id,
      fechaReporte: `${f.fecha}T00:00:00.000Z`,
      moneda: f.moneda,
      subidoEl: (f.subido_el as Date).toISOString(),
      subidoPor: f.subido_por,
      totalRegistros: f.total_registros,
    }));
    return NextResponse.json({ success: true, historial });
  } catch (e) {
    return errorResponse(e);
  }
}
```
(`GLOBAL` se admite para el admin y devuelve vacío, igual que hoy.)

- [ ] **Step 2: `app/api/reportes/dia/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { diaDeReporte } from "@/lib/retirosFila";

/** SLA del día (sin Autopago ni exonerados) y cuántos exonerados tuvo. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const moneda = searchParams.get("moneda") ?? "";
    const dia = diaDeReporte(searchParams.get("fecha"));
    exigirMoneda(yo, moneda, { global: true });
    if (!dia) throw new HttpError(400, "Fecha inválida.");

    const [r] = await sql`
      select
        count(*) filter (where not autopago and exonerado)::int as exonerados,
        count(*) filter (where not autopago and not exonerado)::int as evaluables,
        count(*) filter (where not autopago and not exonerado and cumple)::int as cumplidos
      from retiros
      where moneda = ${moneda} and fecha_reporte = ${dia}::date`;

    return NextResponse.json({
      success: true,
      sla: r.evaluables ? (r.cumplidos / r.evaluables) * 100 : 0,
      exonerados: r.exonerados,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 3: `useReportesMes` usa la API**

En `components/reportes/useReportesMes.ts`, reemplazar imports de Firestore/`FirebaseError`/`db`/`addMonths` por `import { apiFetch } from "@/lib/apiFetch";` y la función `consultarMes` entera por:
```ts
async function consultarMes(currency: string, mes: string) {
  const { historial } = await apiFetch<{ historial: HistorialReporte[] }>(
    `/api/reportes/mes?moneda=${encodeURIComponent(currency)}&mes=${mes}`,
  );
  return historial;
}
```
Mantener `import { getDaysInMonth } from "date-fns";` y `parseMesStr` (los usa `dias`); quitar `toMesStr` si queda sin uso.

- [ ] **Step 4: `useDiaDetalle` usa la API**

Reemplazar imports de Firestore, `db` e `isExonerated` por `import { apiFetch } from "@/lib/apiFetch";` y el `getDocs(…).then(…)` por:
```ts
    apiFetch<DetalleDia>(
      `/api/reportes/dia?moneda=${encodeURIComponent(moneda)}&fecha=${fechaReporte.slice(0, 10)}`,
    )
      .then(({ sla, exonerados }) => {
        if (!cancelado) setCache((c) => ({ ...c, [id]: { sla, exonerados } }));
      })
```
(el `.catch` queda igual).

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`, `npm run build`.
Manual: `/reportes` con CLP en el mes actual → el calendario muestra los mismos días cargados que producción; al elegir un día, el panel muestra el mismo SLA y exonerados que producción para ese día.

- [ ] **Step 6: Commit**

```bash
git add app/api/reportes components/reportes/useReportesMes.ts components/reportes/useDiaDetalle.ts
git commit -m "feat(reportes): calendario y SLA del día desde Postgres"
```

---

### Task 6: Auditoría diaria

**Files:**
- Create: `app/api/auditoria/route.ts`, `app/api/auditoria/comentario/route.ts`, `app/api/auditoria/nota/route.ts`
- Modify: `components/auditoria/useAuditoria.ts`

**Interfaces:**
- Produces: `GET /api/auditoria?moneda&fecha` → `{ ops: OperacionRow[]; nota: string }`; `PATCH /api/auditoria/comentario` body `{ id, comentario }`; `PUT /api/auditoria/nota` body `{ moneda, fecha, observacion }`.

- [ ] **Step 1: `app/api/auditoria/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { diaDeReporte } from "@/lib/retirosFila";
import type { OperacionRow } from "@/components/auditoria/calculos";

/** Retiros de un día y moneda, ordenados por hora, más la nota del día. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const moneda = searchParams.get("moneda") ?? "";
    const dia = diaDeReporte(searchParams.get("fecha"));
    exigirMoneda(yo, moneda, { global: true });
    if (!dia) throw new HttpError(400, "Fecha inválida.");

    const [filas, notas] = await Promise.all([
      sql`
        select id, fecha_operacion, alias, cantidad, tiempo, cumple, operador, nivel, comentario_brecha
        from retiros where fecha_reporte = ${dia}::date and moneda = ${moneda}`,
      sql`select observacion from observaciones_diarias where moneda = ${moneda} and fecha = ${dia}::date`,
    ]);

    const ops: OperacionRow[] = filas.map((r) => ({
      id: r.id,
      hora: r.fecha_operacion.includes(" ") ? r.fecha_operacion.split(" ")[1] : "00:00:00",
      alias: r.alias,
      cantidad: r.cantidad,
      tiempo: r.tiempo,
      cumple: r.cumple,
      operador: r.operador,
      nivel: r.nivel || "Estándar",
      comentarioBrecha: r.comentario_brecha,
    }));
    ops.sort((a, b) => a.hora.localeCompare(b.hora));

    return NextResponse.json({ success: true, ops, nota: notas[0]?.observacion ?? "" });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 2: `app/api/auditoria/comentario/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";

/** Guarda (o borra, con "") el comentario de brecha de un retiro. */
export async function PATCH(request: Request) {
  try {
    const yo = await requireUser(request);
    const { id, comentario } = await request.json();
    if (typeof id !== "string" || typeof comentario !== "string" || comentario.length > 2000)
      throw new HttpError(400, "Datos inválidos.");

    const [fila] = await sql`select moneda from retiros where id = ${id}`;
    if (!fila) throw new HttpError(404, "El retiro ya no existe. Recarga la página.");
    exigirMoneda(yo, fila.moneda);

    await sql`update retiros set comentario_brecha = ${comentario} where id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 3: `app/api/auditoria/nota/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { diaDeReporte } from "@/lib/retirosFila";

/** Guarda la nota del día de una moneda. */
export async function PUT(request: Request) {
  try {
    const yo = await requireUser(request);
    const { moneda, fecha, observacion } = await request.json();
    const dia = diaDeReporte(fecha);
    if (typeof moneda !== "string" || !dia || typeof observacion !== "string" || observacion.length > 5000)
      throw new HttpError(400, "Datos inválidos.");
    exigirMoneda(yo, moneda);

    await sql`
      insert into observaciones_diarias (moneda, fecha, observacion, fecha_actualizacion)
      values (${moneda}, ${dia}::date, ${observacion}, now())
      on conflict (moneda, fecha) do update set
        observacion = excluded.observacion, fecha_actualizacion = now()`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 4: `useAuditoria` usa la API**

En `components/auditoria/useAuditoria.ts`: reemplazar imports de Firestore y `db` por `import { apiFetch } from "@/lib/apiFetch";`. Reemplazar `cargarDia` por:
```ts
function cargarDia(currency: string, fecha: string) {
  return apiFetch<{ ops: OperacionRow[]; nota: string }>(
    `/api/auditoria?moneda=${encodeURIComponent(currency)}&fecha=${fecha}`,
  );
}
```
En `guardarComentario`, reemplazar `await updateDoc(…)` por:
```ts
    await apiFetch("/api/auditoria/comentario", {
      method: "PATCH",
      body: JSON.stringify({ id, comentario: valor }),
    });
```
En `guardarNota`, reemplazar `await setDoc(…)` por:
```ts
      await apiFetch("/api/auditoria/nota", {
        method: "PUT",
        body: JSON.stringify({ moneda: currency, fecha, observacion }),
      });
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`, `npm run build`.
Manual en `/auditoria-diaria` (CLP, un día con brechas):
- Lista, horas y orden iguales a producción.
- Exonerar un retiro → recargar la página → sigue exonerado; en `/reportes` ese día suma un exonerado.
- Guardar la nota del día → recargar → se mantiene.
- Recargar el día por API desde `/reportes` (sin borrar) → volver a auditoría → la exoneración sigue (Review Focus 1).
- Con un agente nacional, abrir `/api/auditoria?moneda=CLP&fecha=…` desde la consola con su token → 403.

- [ ] **Step 6: Commit**

```bash
git add app/api/auditoria components/auditoria/useAuditoria.ts
git commit -m "feat(auditoria): auditoría diaria, exoneraciones y nota desde Postgres"
```

---

### Task 7: Dashboard agregado en el servidor

**Files:**
- Create: `lib/dashboard.ts`, `tests/dashboard.test.ts`, `app/api/dashboard/route.ts`
- Modify: `components/dashboard/useDashboardData.ts`

**Interfaces:**
- Produces:
  - `type Celda = { fecha: string; operador: string; nivel: string; cumple: boolean; exonerado: boolean; n: number; tiempo: number /* suma */; monto: number /* suma de Cantidad */ }`
  - `resumir(c: Celda[]): Resumen`, `serieDiaria(c: Celda[], desde: Date, hasta: Date): Punto[]`, `porNivel(c: Celda[]): NivelRow[]`, `porOperador(c: Celda[]): OperadorRow[]`
  - `armarVistas(curr: Celda[], prev: Celda[], desde: Date, hasta: Date): { todos: Vista; vip: Vista }`
  - Tipos `Resumen`, `Punto`, `NivelKey`, `NivelRow`, `OperadorRow`, `Vista` se mueven aquí; `useDashboardData.ts` los re-exporta (los componentes no cambian sus imports).
  - `GET /api/dashboard?moneda&desde&hasta&prevDesde&prevHasta&serieHasta&historico=0|1` → `{ todos: Vista; vip: Vista }`.

- [ ] **Step 1: Tests que fallan — `tests/dashboard.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { armarVistas, porNivel, porOperador, resumir, serieDiaria, type Celda } from "@/lib/dashboard";

const c = (p: Partial<Celda>): Celda => ({
  fecha: "2026-09-01", operador: "Ana", nivel: "", cumple: true, exonerado: false,
  n: 1, tiempo: 10, monto: 10000, ...p,
});

const celdas: Celda[] = [
  c({ n: 8, tiempo: 80 }),                                    // 8 cumplen, 10 min c/u
  c({ cumple: false, n: 2, tiempo: 60 }),                     // 2 brechas, 30 min c/u
  c({ cumple: false, exonerado: true, n: 1, tiempo: 50 }),    // exonerado: fuera del SLA
  c({ operador: "Autopago", n: 4, tiempo: 4, monto: 40000 }), // autopago: fuera del SLA
  c({ fecha: "2026-09-02", operador: "Luis", nivel: " Nivel 3 ", n: 5, tiempo: 25 }),
];

describe("resumir con celdas", () => {
  test("cuenta por n y deja fuera autopago y exonerados", () => {
    const r = resumir(celdas);
    expect(r.total).toBe(20);
    expect(r.autopago).toBe(4);
    expect(r.exonerados).toBe(1);
    expect(r.evaluables).toBe(15);
    expect(r.cumplidos).toBe(13);
    expect(r.incumplidos).toBe(2);
    expect(r.sla).toBeCloseTo((13 / 15) * 100);
    expect(r.tiempo).toBeCloseTo((80 + 60 + 25) / 15);
    expect(r.vipTotal).toBe(5);
    expect(r.automatizacion).toBeCloseTo(20);
  });
});

describe("serieDiaria con celdas", () => {
  test("rellena días vacíos y calcula SLA por día", () => {
    const s = serieDiaria(celdas, new Date(2026, 8, 1), new Date(2026, 8, 3));
    expect(s.map((p) => p.clave)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(s[0].volumen).toBe(15);
    expect(s[0].sla).toBe(80); // 8 de 10
    expect(s[1].sla).toBe(100);
    expect(s[2].sla).toBeNull();
  });
});

describe("porNivel y porOperador", () => {
  test("niveles por n, con trim", () => {
    expect(porNivel(celdas).find((x) => x.nivel === "Nivel 3")!.cantidad).toBe(5);
    expect(porNivel(celdas).find((x) => x.nivel === "Estándar")!.cantidad).toBe(15);
  });
  test("operadores sin autopago, ordenados por brechas", () => {
    const ops = porOperador(celdas);
    expect(ops.map((o) => o.nombre)).toEqual(["Luis", "Ana"]);
    const ana = ops.find((o) => o.nombre === "Ana")!;
    expect(ana.retiros).toBe(11);
    expect(ana.brechas).toBe(2);
    expect(ana.sla).toBeCloseTo(80);
  });
});

describe("armarVistas", () => {
  test("la vista VIP filtra celdas; niveles siempre sobre el total", () => {
    const v = armarVistas(celdas, [], new Date(2026, 8, 1), new Date(2026, 8, 2));
    expect(v.vip.actual.total).toBe(5);
    expect(v.vip.niveles).toEqual(v.todos.niveles);
    expect(v.todos.anterior.total).toBe(0);
  });
});
```
Run: `npm test` → FAIL (módulo no existe).

- [ ] **Step 2: Crear `lib/dashboard.ts`**

Mover desde `components/dashboard/useDashboardData.ts` los tipos `Resumen`, `Punto`, `NivelKey`, `NivelRow`, `OperadorRow`, `Vista`, las funciones `toDateStr`, `parseDateStr`, `bucketDe` (con su tipo `Agrupacion`) y `NIVELES`, y reescribir los cálculos sobre celdas:

```ts
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { VIP_LEVELS } from "@/lib/constants";
import { capitalizar } from "@/lib/format";

/** Grupo de retiros iguales en todo lo que mira el dashboard. `tiempo` y `monto` son sumas. */
export type Celda = {
  fecha: string; // YYYY-MM-DD
  operador: string;
  nivel: string;
  cumple: boolean;
  exonerado: boolean;
  n: number;
  tiempo: number;
  monto: number;
};

// … tipos Resumen, Punto, NivelKey, NivelRow, OperadorRow, Vista tal cual estaban …

export const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");

export const parseDateStr = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const esVip = (c: Celda) => (VIP_LEVELS as readonly string[]).includes(c.nivel.trim());
const esAutopago = (c: Celda) => c.operador === "Autopago";

export function resumir(celdas: Celda[]): Resumen {
  let total = 0, exo = 0, cum = 0, inc = 0, t = 0, monto = 0, auto = 0, vip = 0;
  for (const c of celdas) {
    total += c.n;
    monto += c.monto / 100;
    if (esVip(c)) vip += c.n;
    // Regla única de SLA: Autopago y exonerados no cuentan para SLA ni tiempo.
    if (esAutopago(c)) {
      auto += c.n;
      continue;
    }
    if (c.exonerado) {
      exo += c.n;
      continue;
    }
    t += c.tiempo;
    if (c.cumple) cum += c.n;
    else inc += c.n;
  }
  const ev = cum + inc;
  return {
    total,
    exonerados: exo,
    evaluables: ev,
    cumplidos: cum,
    incumplidos: inc,
    sla: ev ? (cum / ev) * 100 : 0,
    tiempo: ev ? t / ev : 0,
    monto,
    autopago: auto,
    automatizacion: total ? (auto / total) * 100 : 0,
    vipTotal: vip,
  };
}

// bucketDe sin cambios

/** Agrupa por día (o semana/mes en rangos largos) y rellena los huecos. */
export function serieDiaria(celdas: Celda[], desde: Date, hasta: Date): Punto[] {
  if (hasta < desde) return [];
  const dias = differenceInCalendarDays(hasta, desde) + 1;
  const agrupacion: Agrupacion = dias > 200 ? "mes" : dias > 62 ? "semana" : "dia";

  const acc = new Map<string, { base: ReturnType<typeof bucketDe>; total: number; cum: number; ev: number }>();
  for (let d = desde; d <= hasta; d = addDays(d, 1)) {
    const base = bucketDe(d, agrupacion);
    if (!acc.has(base.clave)) acc.set(base.clave, { base, total: 0, cum: 0, ev: 0 });
  }
  for (const c of celdas) {
    const b = acc.get(bucketDe(parseDateStr(c.fecha), agrupacion).clave);
    if (!b) continue;
    b.total += c.n;
    if (esAutopago(c) || c.exonerado) continue;
    b.ev += c.n;
    if (c.cumple) b.cum += c.n;
  }
  return [...acc.values()].map(({ base, total, cum, ev }) => ({
    ...base,
    volumen: total,
    sla: ev ? Math.round((cum / ev) * 1000) / 10 : null,
  }));
}

export function porNivel(celdas: Celda[]): NivelRow[] {
  const cuenta: Record<NivelKey, number> = { Estándar: 0, "Nivel 2": 0, "Nivel 3": 0, "Nivel 4": 0 };
  for (const c of celdas) cuenta[esVip(c) ? (c.nivel.trim() as NivelKey) : "Estándar"] += c.n;
  return NIVELES.map((nivel) => ({ nivel, cantidad: cuenta[nivel] }));
}

export function porOperador(celdas: Celda[]): OperadorRow[] {
  const map = new Map<string, { total: number; cum: number; inc: number; ev: number; t: number }>();
  for (const c of celdas) {
    if (esAutopago(c)) continue;
    const o = map.get(c.operador) ?? { total: 0, cum: 0, inc: 0, ev: 0, t: 0 };
    o.total += c.n;
    if (!c.exonerado) {
      o.ev += c.n;
      o.t += c.tiempo;
      if (c.cumple) o.cum += c.n;
      else o.inc += c.n;
    }
    map.set(c.operador, o);
  }
  return [...map.entries()]
    .map(([nombre, o]) => ({
      nombre,
      retiros: o.total,
      brechas: o.inc,
      tiempo: o.ev ? o.t / o.ev : 0,
      sla: o.ev ? (o.cum / o.ev) * 100 : 0,
    }))
    .sort((a, b) => a.brechas - b.brechas || b.sla - a.sla || b.retiros - a.retiros);
}

/** Las dos vistas del dashboard (todas y solo VIP). */
export function armarVistas(curr: Celda[], prev: Celda[], desde: Date, hasta: Date) {
  const vista = (soloVip: boolean): Vista => {
    const c = soloVip ? curr.filter(esVip) : curr;
    const p = soloVip ? prev.filter(esVip) : prev;
    return {
      actual: resumir(c),
      anterior: resumir(p),
      diaria: serieDiaria(c, desde, hasta),
      niveles: porNivel(curr), // siempre sobre el total; la card decide qué mostrar
      operadores: porOperador(c),
    };
  };
  return { todos: vista(false), vip: vista(true) };
}
```
Run: `npm test` → PASS.

- [ ] **Step 3: `app/api/dashboard/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { armarVistas, parseDateStr, type Celda } from "@/lib/dashboard";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Las vistas del dashboard ya calculadas para un período y su período de comparación. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const p = new URL(request.url).searchParams;
    const moneda = p.get("moneda") ?? "";
    const historico = p.get("historico") === "1";
    const [desde, hasta, prevDesde, prevHasta, serieHasta] = ["desde", "hasta", "prevDesde", "prevHasta", "serieHasta"].map(
      (k) => p.get(k) ?? "",
    );
    exigirMoneda(yo, moneda, { global: true });
    if (![desde, hasta, prevDesde, prevHasta, serieHasta].every((d) => DIA.test(d)))
      throw new HttpError(400, "Período inválido.");

    const filtroMoneda = moneda === "GLOBAL" ? sql`` : sql`and moneda = ${moneda}`;
    const filtroFecha = historico
      ? sql``
      : sql`and fecha_reporte between least(${prevDesde}::date, ${desde}::date) and ${hasta}::date`;

    const celdas = (await sql`
      select fecha_reporte::text as fecha, operador, btrim(nivel) as nivel, cumple, exonerado,
             count(*)::int as n, sum(tiempo)::float8 as tiempo, sum(cantidad)::float8 as monto
      from retiros
      where true ${filtroMoneda} ${filtroFecha}
      group by fecha_reporte, operador, btrim(nivel), cumple, exonerado`) as unknown as Celda[];

    const curr = historico ? celdas : celdas.filter((c) => c.fecha >= desde && c.fecha <= hasta);
    const prev = historico ? [] : celdas.filter((c) => c.fecha >= prevDesde && c.fecha <= prevHasta);
    const inicioSerie = historico && curr.length ? curr.reduce((m, c) => (c.fecha < m ? c.fecha : m), curr[0].fecha) : desde;

    const vistas = armarVistas(curr, prev, parseDateStr(inicioSerie), parseDateStr(serieHasta));
    return NextResponse.json({ success: true, ...vistas });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 4: El hook pide la vista a la API**

En `components/dashboard/useDashboardData.ts`:
1. Borrar lo movido a `lib/dashboard.ts` y el tipo `Retiro`; borrar imports de Firestore, `db`, `isExonerated`, `VIP_LEVELS`, `addDays`, `startOfMonth`, `startOfWeek`.
2. Agregar:
```ts
import { apiFetch } from "@/lib/apiFetch";
import { parseDateStr, toDateStr, type Vista } from "@/lib/dashboard";
export type { NivelKey, NivelRow, OperadorRow, Punto, Resumen, Vista } from "@/lib/dashboard";
```
3. Reemplazar el cuerpo de `cargar` por:
```ts
      try {
        const hasta = periodo.currEnd < now ? periodo.currEnd : now;
        const qs = new URLSearchParams({
          moneda: currency,
          desde: toDateStr(periodo.currStart),
          hasta: toDateStr(periodo.currEnd),
          prevDesde: toDateStr(periodo.prevStart),
          prevHasta: toDateStr(periodo.prevEnd),
          serieHasta: toDateStr(hasta),
          historico: periodo.esHistorico ? "1" : "0",
        });
        const { todos, vip } = await apiFetch<{ todos: Vista; vip: Vista }>(`/api/dashboard?${qs}`);
        if (!cancelado) setResultado({ key, ok: true, todos, vip });
      } catch (error) {
        console.error("Error cargando métricas:", error);
        if (!cancelado) setResultado({ key, ok: false });
      }
```
`parseDateStr` solo se importa si algo del hook lo sigue usando; si no, quitarlo.

- [ ] **Step 5: Verificar contra producción**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`.
Manual: abrir el dashboard en producción y en local (`npm run dev`) lado a lado, mismo período:
- GLOBAL · mes pasado: total, SLA, tiempo promedio, monto, autopago, exonerados, VIP, tabla de operadores y gráfico iguales (decimales pueden variar en el último dígito por orden de suma).
- CLP · mes en curso con toggle VIP.
- GLOBAL · histórico completo: debe cargar en pocos segundos (hoy descarga ~450.000 documentos).
- Con un agente internacional, forzar `moneda=GLOBAL` en la URL de la API → 403.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard.ts tests/dashboard.test.ts app/api/dashboard components/dashboard/useDashboardData.ts
git commit -m "feat(dashboard): métricas agregadas en Postgres; el navegador recibe solo el resultado"
```

---

### Task 8: Monitor regional sobre celdas

**Files:**
- Create: `app/api/monitor/route.ts`, `tests/monitor.test.ts`
- Modify: `lib/monitor.ts`, `components/monitor/useMonitor.ts`

**Interfaces:**
- Produces: `OpMonitor` gana `n: number` y `tiempo` pasa a ser la suma de minutos del grupo; `hora` solo viene informada en brechas. `GET /api/monitor?mes=YYYY-MM` (solo admin) → `{ ops: OpMonitor[] }`.

- [ ] **Step 1: Tests que fallan — `tests/monitor.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { agregarMes, slaDe, tiempoDe, type OpMonitor } from "@/lib/monitor";

const op = (p: Partial<OpMonitor>): OpMonitor => ({
  dia: 1, hora: null, moneda: "CLP", autopago: false, vip: false,
  cumple: true, tiempo: 10, exonerado: false, n: 1, ...p,
});

describe("agregarMes con celdas", () => {
  const ops = [
    op({ n: 9, tiempo: 90 }),
    op({ cumple: false, hora: 14, n: 3, tiempo: 120 }),
    op({ autopago: true, n: 5, tiempo: 5 }),
    op({ exonerado: true, cumple: false, n: 2, tiempo: 80 }),
    op({ dia: 2, moneda: "VES", vip: true, n: 4, tiempo: 40 }),
  ];

  test("suma por n y separa autopago y exonerados", () => {
    const clp = agregarMes(ops, false, 30).CLP!.mes;
    expect(clp.total).toBe(19);
    expect(clp.autopago).toBe(5);
    expect(clp.exonerados).toBe(2);
    expect(clp.evaluables).toBe(12);
    expect(clp.brechas).toBe(3);
    expect(clp.brechasHora[14]).toBe(3);
    expect(slaDe(clp)).toBeCloseTo(75);
    expect(tiempoDe(clp)).toBeCloseTo(210 / 12);
  });

  test("solo VIP deja únicamente las celdas VIP", () => {
    const agg = agregarMes(ops, true, 30);
    expect(agg.CLP).toBeUndefined();
    expect(agg.VES!.mes.total).toBe(4);
  });
});
```
Run: `npm test` → FAIL (falta `n` en el tipo / totales no cuadran).

- [ ] **Step 2: `lib/monitor.ts` suma celdas**

Cambiar el tipo:
```ts
/** Grupo de retiros iguales (lo que manda la API y se guarda en caché). */
export type OpMonitor = {
  dia: number; // día del mes del reporte
  hora: number | null; // hora de la operación (0–23); solo viene en brechas
  moneda: Moneda;
  autopago: boolean;
  vip: boolean;
  cumple: boolean;
  tiempo: number; // suma de minutos del grupo
  exonerado: boolean;
  n: number; // cantidad de retiros del grupo
};
```
y `sumarEn`:
```ts
function sumarEn(a: Seg, op: OpMonitor) {
  a.total += op.n;
  if (op.autopago) {
    a.autopago += op.n;
    return;
  }
  if (op.exonerado) {
    a.exonerados += op.n;
    return;
  }
  a.evaluables += op.n;
  a.tiempoTotal += op.tiempo;
  if (op.cumple) a.cumplidos += op.n;
  else {
    a.brechas += op.n;
    if (op.hora != null && op.hora >= 0 && op.hora < 24) a.brechasHora[op.hora] += op.n;
  }
}
```
`ultimoDiaConDatos` no cambia (mira `dia`). Run: `npm test` → PASS.

- [ ] **Step 3: `app/api/monitor/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { MONEDAS, type OpMonitor } from "@/lib/monitor";

/** Retiros del mes agrupados para el monitor. La hora solo se separa en las brechas. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const mes = new URL(request.url).searchParams.get("mes") ?? "";
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, "Mes inválido.");

    const ops = (await sql`
      select extract(day from fecha_reporte)::int as dia,
             case when not autopago and not exonerado and not cumple then hora end as hora,
             moneda, autopago, vip, cumple, exonerado,
             count(*)::int as n, sum(tiempo)::float8 as tiempo
      from retiros
      where fecha_reporte >= ${`${mes}-01`}::date
        and fecha_reporte < ${`${mes}-01`}::date + interval '1 month'
        and moneda in ${sql([...MONEDAS])}
      group by 1, 2, 3, 4, 5, 6, 7`) as unknown as OpMonitor[];

    return NextResponse.json({ success: true, ops });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 4: `useMonitor` pide las celdas y renueva la caché**

En `components/monitor/useMonitor.ts`:
1. Imports: quitar Firestore, `db`, `isExonerated`, `VIP_LEVELS`, `Moneda`; agregar `import { apiFetch } from "@/lib/apiFetch";`.
2. Tupla con `n` y clave nueva (las cachés viejas no traen `n`):
```ts
type Tupla = [number, number, number, 0 | 1, 0 | 1, 0 | 1, number, 0 | 1, number];
const clave = (mes: string) => `monitor2:${mes}`;
```
En `aTupla` agregar `o.n` al final; en `deTupla` agregar `n: t[8],`.
3. `consultarMes`:
```ts
async function consultarMes(mes: string): Promise<OpMonitor[]> {
  const { ops } = await apiFetch<{ ops: OpMonitor[] }>(`/api/monitor?mes=${mes}`);
  return ops;
}
```
4. Agregar a `tests/monitor.test.ts` un test de ida y vuelta: exportar `aTupla` y `deTupla` desde `useMonitor.ts` (solo para el test) y comprobar `deTupla(aTupla(x))` igual a `x` para una celda con `hora: null` y otra con `hora: 14`. Si importar el hook en Vitest falla por `"use client"`/`apiFetch`, mover `aTupla`/`deTupla` a `lib/monitor.ts` y exportarlas desde ahí.

- [ ] **Step 5: Verificar**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`.
Manual como admin en `/monitor-regional`, lado a lado con producción: mes pasado y mes en curso, con y sin VIP. KPIs, tarjetas por moneda, mapa de calor, franja crítica por hora, peores días, tabla comparativa y PDF iguales. En DevTools → Network, la respuesta de `/api/monitor` debe pesar decenas o cientos de KB (hoy son ~13 MB de Firestore).

- [ ] **Step 6: Commit**

```bash
git add lib/monitor.ts components/monitor/useMonitor.ts app/api/monitor tests/monitor.test.ts
git commit -m "feat(monitor): monitor regional con retiros agrupados en Postgres"
```

---

### Task 9: Evaluación diaria y expediente

**Files:**
- Create: `app/api/evaluacion/retiros-dia/route.ts`, `app/api/expediente/retiros/route.ts`
- Modify: `components/evaluacion/sincronizar.ts`, `app/(dashboard)/evaluacion-diaria/page.tsx`, `lib/expedienteServer.ts`, `components/expediente/cargadorCliente.ts`

**Interfaces:**
- Consumes: `retirosDeOperador` (Tarea 3).
- Produces: `GET /api/evaluacion/retiros-dia?fecha=YYYY-MM-DD` → `{ grupos: GrupoDia[] }` con `GrupoDia = { operador: string; moneda: string; total: number; exonerados: number; evaluables: number; cumplen: number; tiempo: number }`; `GET /api/expediente/retiros?operador&desde&hasta` → `{ retiros: RetiroOperador[] }`. `sincronizarDia` deja de recibir `rol`.

- [ ] **Step 1: `app/api/evaluacion/retiros-dia/route.ts`**

```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { getMonedasByRol } from "@/lib/roles";
import { diaDeReporte } from "@/lib/retirosFila";

/** Retiros del día por operador y moneda (sin Autopago), solo de las monedas del grupo de quien llama. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const dia = diaDeReporte(new URL(request.url).searchParams.get("fecha"));
    if (!dia) throw new HttpError(400, "Fecha inválida.");

    const grupos = await sql`
      select operador, moneda,
             count(*)::int as total,
             count(*) filter (where exonerado)::int as exonerados,
             count(*) filter (where not exonerado)::int as evaluables,
             count(*) filter (where not exonerado and cumple)::int as cumplen,
             coalesce(sum(tiempo) filter (where not exonerado), 0)::float8 as tiempo
      from retiros
      where fecha_reporte = ${dia}::date
        and moneda in ${sql(getMonedasByRol(yo.rol))}
        and operador not ilike '%autopago%'
      group by operador, moneda`;
    return NextResponse.json({ success: true, grupos });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 2: `sincronizarDia` usa los grupos**

En `components/evaluacion/sincronizar.ts`:
1. Imports: quitar `collection`… solo lo que ya no se use (siguen `doc`, `getDocs`, `query`, `where`, `writeBatch` para `evaluaciones_desempeno`); quitar `isExonerated` y `getMonedasByRol`; agregar `import { apiFetch } from "@/lib/apiFetch";`.
2. Firma: `export async function sincronizarDia({ dia, esExcluido }: { dia: string; esExcluido: (nombre: string) => boolean })`.
3. Reemplazar desde `const monedasPermitidas = …` hasta el cierre del `snapOps.forEach` por:
```ts
  type GrupoDia = {
    operador: string;
    moneda: string;
    total: number;
    exonerados: number;
    evaluables: number;
    cumplen: number;
    tiempo: number;
  };
  const { grupos } = await apiFetch<{ grupos: GrupoDia[] }>(`/api/evaluacion/retiros-dia?fecha=${dia}`);

  const porOperador: Record<string, Acumulado> = {};
  for (const g of grupos) {
    if (esExcluido(g.operador)) continue;
    const a = (porOperador[g.operador] ??= {
      total: 0,
      evaluables: 0,
      cumplen: 0,
      tiempo: 0,
      exonerados: 0,
      monedas: {},
    });
    a.total += g.total;
    a.monedas[g.moneda] = (a.monedas[g.moneda] ?? 0) + g.total;
    a.exonerados += g.exonerados;
    a.evaluables += g.evaluables;
    a.cumplen += g.cumplen;
    a.tiempo += g.tiempo;
  }
```
El resto (escritura en `evaluaciones_desempeno`) no cambia.
4. En `app/(dashboard)/evaluacion-diaria/page.tsx` quitar `rol: userData?.rol,` de la llamada, y cambiar el toast de error a `"Error al sincronizar los datos."`.

- [ ] **Step 3: Expediente**

`app/api/expediente/retiros/route.ts`:
```ts
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { retirosDeOperador } from "@/lib/retirosRepo";
import { diaDeReporte } from "@/lib/retirosFila";

/** Retiros de un operador en un rango (expediente en modo interno). */
export async function GET(request: Request) {
  try {
    await requireUser(request);
    const p = new URL(request.url).searchParams;
    const operador = p.get("operador") ?? "";
    const desde = diaDeReporte(p.get("desde"));
    const hasta = diaDeReporte(p.get("hasta"));
    if (!operador || !desde || !hasta) throw new HttpError(400, "Parámetros inválidos.");
    return NextResponse.json({ success: true, retiros: await retirosDeOperador(operador, desde, hasta) });
  } catch (e) {
    return errorResponse(e);
  }
}
```
En `lib/expedienteServer.ts`, reemplazar el método `retirosOperador` completo por:
```ts
  retirosOperador: (operador, desde, hasta) => retirosDeOperador(operador, desde, hasta),
```
con `import { retirosDeOperador } from "@/lib/retirosRepo";`.

En `components/expediente/cargadorCliente.ts`, reemplazar `retirosOperador` por:
```ts
  async retirosOperador(operador, desde, hasta) {
    const qs = new URLSearchParams({ operador, desde, hasta });
    const { retiros } = await apiFetch<{ retiros: RetiroOperador[] }>(`/api/expediente/retiros?${qs}`);
    return retiros;
  },
```
con `import { apiFetch } from "@/lib/apiFetch";`; quitar `getDocsConRespaldo` del import si queda sin uso.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`, `npm run build`.
Manual:
- `/evaluacion-diaria`, día ya evaluado en producción → Sincronizar → los puntajes automáticos (SLA %, tiempo, total, exonerados) quedan iguales a los de producción.
- Expediente de un operador (desde Cierre mensual) → mismos números que producción.
- Enlace público del expediente en ventana privada → abre y muestra lo mismo.

- [ ] **Step 5: Commit**

```bash
git add app/api/evaluacion app/api/expediente/retiros components/evaluacion/sincronizar.ts "app/(dashboard)/evaluacion-diaria/page.tsx" lib/expedienteServer.ts components/expediente/cargadorCliente.ts
git commit -m "feat(evaluacion): sincronización y expediente leen retiros de Postgres"
```

---

### Task 10: Cierre de la fase y guía de paso a producción

**Files:**
- Create: `new_views/deploy-supabase-fase1.md`

- [ ] **Step 1: Ningún acceso a las colecciones migradas queda en la app**

Run: `grep -rnE "operaciones_retiros|historial_reportes|observaciones_diarias" app components lib`
Expected: sin resultados (los scripts sí las nombran, por eso no se incluye `scripts/`).

- [ ] **Step 2: Todo verde**

Run: `npm test` → PASS. `npx tsc --noEmit` → limpio. `npm run build` → compila. `npx eslint app/api lib components/dashboard components/monitor components/auditoria components/reportes components/evaluacion components/expediente tests scripts` → sin errores nuevos.

- [ ] **Step 3: Guía de paso a producción — `new_views/deploy-supabase-fase1.md`**

```markdown
# Paso a producción: Supabase fase 1 (retiros)

Requisito: `feature/nuevas-vistas` ya está en `main` y en producción.

## Antes (cualquier día)
1. Vercel → Settings → Environment Variables: agregar `DATABASE_URL` (transaction pooler, puerto 6543) para **Production y Preview**. `DIRECT_URL` no hace falta en Vercel.
2. Abrir un PR de `feature/supabase` a `main` y probar el Preview completo (dashboard, monitor, reportes, auditoría, evaluación, expediente).

## El corte (fuera de horario, ~15 minutos)
1. Avisar que nadie cargue reportes ni exonere durante el corte.
2. `npm run db:copiar` → copia fresca de Firestore.
3. `npm run db:verificar` → debe decir "Todo coincide."
4. Hacer merge del PR. Vercel despliega en `pdx1`.
5. Probar en producción: cargar un día por API, exonerar un retiro, abrir dashboard y monitor.

## Si algo sale mal
- Vercel → Deployments → el deploy anterior → **Instant Rollback**. La app vuelve a leer Firestore, que quedó intacto.
- Lo que se haya cargado o exonerado en Postgres después del corte no estará en Firestore: anotarlo y repetirlo a mano.

## Después
- Firestore conserva las tres colecciones como respaldo. No se borran en esta fase.
- Fase 2: evaluaciones, cierres, configuración y enlaces.
```

- [ ] **Step 4: Commit**

```bash
git add new_views/deploy-supabase-fase1.md
git commit -m "docs: guía de paso a producción de Supabase fase 1"
```
