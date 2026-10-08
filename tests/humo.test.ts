import { expect, test } from "vitest";
import { VIP_LEVELS } from "@/lib/constants";

test("vitest resuelve el alias @", () => {
  expect(VIP_LEVELS).toContain("Nivel 2");
});
