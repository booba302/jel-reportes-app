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
