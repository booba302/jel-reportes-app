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

describe("tupla de caché", () => {
  test("ida y vuelta conserva n, hora null y hora informada", async () => {
    const { aTupla, deTupla } = await import("@/lib/monitor");
    const a = op({ n: 7, tiempo: 70.5 });
    const b = op({ cumple: false, hora: 14, n: 2, tiempo: 61, moneda: "VES", vip: true });
    expect(deTupla(aTupla(a))).toEqual(a);
    expect(deTupla(aTupla(b))).toEqual(b);
  });
});
