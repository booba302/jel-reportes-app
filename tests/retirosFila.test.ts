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
    expect(diaDeReporte("2026-13-01")).toBeNull();
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
