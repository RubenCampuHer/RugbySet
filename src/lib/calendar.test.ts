import { describe, expect, it } from "vitest";
import { fechaToInputValue, inputValueToFecha } from "./calendar";

describe("fechaToInputValue", () => {
  it("convierte dd/MM/yyyy a yyyy-MM-dd", () => {
    expect(fechaToInputValue("05/09/2026")).toBe("2026-09-05");
  });

  it("formato no reconocido da string vacío", () => {
    expect(fechaToInputValue("no-es-una-fecha")).toBe("");
  });
});

describe("inputValueToFecha", () => {
  it("convierte yyyy-MM-dd a dd/MM/yyyy", () => {
    expect(inputValueToFecha("2026-09-05")).toBe("05/09/2026");
  });

  it("formato no reconocido da null", () => {
    expect(inputValueToFecha("")).toBeNull();
    expect(inputValueToFecha("05/09/2026")).toBeNull();
  });

  it("es el inverso exacto de fechaToInputValue", () => {
    expect(inputValueToFecha(fechaToInputValue("05/09/2026"))).toBe("05/09/2026");
  });
});
