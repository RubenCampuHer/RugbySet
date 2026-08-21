import { describe, expect, it } from "vitest";
import { ClubSchema } from "./club";

describe("ClubSchema", () => {
  it("parsea un club completo", () => {
    const result = ClubSchema.parse({
      clubId: "c1",
      clubname: "RC Ejemplo",
      clubcode: "ABC123",
      clubicon: "https://example.com/icon.png",
      adminUserId: "uid1",
      teams: ["RC Ejemplo Seniors", "RC Ejemplo Sub-18"],
    });
    expect(result.teams).toEqual(["RC Ejemplo Seniors", "RC Ejemplo Sub-18"]);
  });

  it("teams por defecto vacío cuando el club aún no tiene equipos", () => {
    expect(ClubSchema.parse({ clubId: "c1" }).teams).toEqual([]);
  });

  it("pendingTeams por defecto vacío (mapa, no array)", () => {
    expect(ClubSchema.parse({ clubId: "c1" }).pendingTeams).toEqual({});
  });

  it("pendingTeams parsea un mapa {teamname: true}", () => {
    const result = ClubSchema.parse({
      clubId: "c1",
      pendingTeams: { "RC Ejemplo Sub-14": true },
    });
    expect(result.pendingTeams).toEqual({ "RC Ejemplo Sub-14": true });
  });

  it("todos los campos de identidad son nullish (club recién creado, sin icono)", () => {
    const result = ClubSchema.parse({});
    expect(result.clubicon).toBeUndefined();
    expect(result.adminUserId).toBeUndefined();
  });
});
