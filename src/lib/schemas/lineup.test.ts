import { describe, expect, it } from "vitest";
import { LineupDocSchema } from "./lineup";

describe("LineupDocSchema", () => {
  it("defaults: starters/bench vacíos, resto ausente", () => {
    const result = LineupDocSchema.parse({});
    expect(result.starters).toEqual({});
    expect(result.bench).toEqual({});
    expect(result.name).toBeUndefined();
  });

  it("acepta nombres del roster y nombres escritos a mano por igual (texto libre)", () => {
    const result = LineupDocSchema.parse({
      starters: { "1": "Juan Pérez", "9": "Invitado Sin Cuenta" },
      bench: { "16": "Marc López" },
    });
    expect(result.starters["9"]).toBe("Invitado Sin Cuenta");
  });

  it("starters/bench como ARRAY (RTDB con 2+ claves numéricas) se reconstruyen sin perder datos — bug real 2026-09-03", () => {
    // Forma exacta encontrada en producción: Teams/Spartans/lineups/{id}
    // tras asignar las posiciones 1, 2 y 3 — sin este fix, TrainingDaySchema
    // (y por tanto TODO el Team que lo contiene) fallaba al parsear, y el
    // usuario veía "no perteneces a ningún equipo" aunque userplayers
    // seguía intacto.
    const result = LineupDocSchema.parse({
      lineupId: "-P0aqFT5e99Xwbx-wHJ1",
      name: "Plan A",
      starters: [null, "Rupert Campuzano Hernández", "Rue Camp", "RU"],
    });
    expect(result.starters).toEqual({
      "1": "Rupert Campuzano Hernández",
      "2": "Rue Camp",
      "3": "RU",
    });
  });

  it("bench como array también se reconstruye", () => {
    const result = LineupDocSchema.parse({
      bench: Array.from({ length: 17 }, (_, i) => (i === 16 ? "Marc López" : null)),
    });
    expect(result.bench).toEqual({ "16": "Marc López" });
  });
});
