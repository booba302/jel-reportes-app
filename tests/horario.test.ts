import { describe, expect, test } from "vitest";
import {
  claveTurno,
  conflictos,
  estaAusente,
  hoyEnZona,
  mesesVisibles,
  rangoRegeneracion,
  ultimoDia,
  validarAusencia,
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
