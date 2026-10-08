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

describe("orden de operadores empatados", () => {
  test("no depende del orden en que llegan las celdas", () => {
    const a = [c({ operador: "Zoe" }), c({ operador: "Marvin" })];
    expect(porOperador(a).map((o) => o.nombre)).toEqual(["Marvin", "Zoe"]);
    expect(porOperador([...a].reverse()).map((o) => o.nombre)).toEqual(["Marvin", "Zoe"]);
  });
});
