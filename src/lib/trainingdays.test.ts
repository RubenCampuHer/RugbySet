import { describe, expect, it } from "vitest";
import { patchRawDay, rawDays, removeRawDay, upsertRawDay } from "./trainingdays";

const days = [
  { fecha: "01/10/2026", horaInicio: "18:00", accepted_players: { u1: true }, foo: "android" },
  { fecha: "03/10/2026", horaInicio: "19:00", lineupId: "L1", bar: 7 },
];

describe("upsertRawDay", () => {
  it("fusiona el día existente conservando asistencia, lineupId y claves desconocidas", () => {
    const out = upsertRawDay(days, "01/10/2026", { horaInicio: "20:00", location: null });
    const d = out.find((x) => x.fecha === "01/10/2026")!;
    expect(d).toEqual({
      fecha: "01/10/2026",
      horaInicio: "20:00",
      accepted_players: { u1: true },
      foo: "android",
    });
    // El resto de días intacto, incluido su campo desconocido.
    expect(out.find((x) => x.fecha === "03/10/2026")).toEqual(days[1]);
    expect(out).toHaveLength(2);
  });

  it("crea el día si no existe", () => {
    const out = upsertRawDay(days, "05/10/2026", { horaInicio: "10:00" });
    expect(out).toHaveLength(3);
    expect(out[2]).toEqual({ fecha: "05/10/2026", horaInicio: "10:00" });
  });
});

describe("patchRawDay", () => {
  it("cambia solo lo indicado y conserva el orden", () => {
    const out = patchRawDay(days, "03/10/2026", { cancelled: true });
    expect(out[1]).toEqual({ ...days[1], cancelled: true });
    expect(out[0]).toBe(days[0]);
  });

  it("null quita la clave", () => {
    const out = patchRawDay(days, "03/10/2026", { lineupId: null });
    expect(out[1]).not.toHaveProperty("lineupId");
    expect(out[1].bar).toBe(7);
  });

  it("falla si el día no existe", () => {
    expect(() => patchRawDay(days, "09/09/2026", { cancelled: true })).toThrow();
  });
});

describe("removeRawDay / rawDays", () => {
  it("quita solo ese día", () => {
    expect(removeRawDay(days, "01/10/2026")).toEqual([days[1]]);
  });
  it("normaliza arrays dispersos de RTDB", () => {
    expect(rawDays({ "0": days[0], "3": days[1] })).toEqual(days);
  });
});
