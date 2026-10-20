// Importa UNA vez octubre 2026 y las vacaciones de "Horario 2026.xlsx" al horario en Postgres.
// Sin --escribir solo valida y muestra el resumen. Se niega si ya hay meses en el sistema.
import fs from "node:fs";
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

const wb = XLSX.read(fs.readFileSync(archivo)); // la build ESM de xlsx no trae readFile

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
