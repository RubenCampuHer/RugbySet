import { describe, expect, it } from "vitest";
import { LineupDocSchema } from "./lineup";

describe("LineupDocSchema", () => {
  it("defaults: starters/bench vacíos, resto ausente", () => {
    const result = LineupDocSchema.parse({});
    expect(result.starters).toEqual({});
    expect(result.bench).toEqual({});
    expect(result.name).toBeUndefined();
    expect(result.matchFecha).toBeUndefined();
  });

  it("matchFecha ausente = plantilla suelta sin partido asignado", () => {
    expect(LineupDocSchema.parse({ name: "Plantilla base" }).matchFecha).toBeUndefined();
  });

  it("acepta nombres del roster y nombres escritos a mano por igual (texto libre)", () => {
    const result = LineupDocSchema.parse({
      matchFecha: "10/09/2026",
      starters: { "1": "Juan Pérez", "9": "Invitado Sin Cuenta" },
      bench: { "16": "Marc López" },
    });
    expect(result.starters["9"]).toBe("Invitado Sin Cuenta");
  });
});
