import { describe, expect, it } from "vitest";
import { CLUB_CATEGORIES, validateTeamName } from "./team-validation";

describe("validateTeamName", () => {
  it("un nombre válido no da error", () => {
    expect(validateTeamName("Spartans")).toBeNull();
  });

  it("vacío o solo espacios es 'Requerido'", () => {
    expect(validateTeamName("")).toBe("Requerido");
    expect(validateTeamName("   ")).toBe("Requerido");
  });

  it.each([".", "#", "$", "[", "]", "/"])(
    "rechaza el carácter prohibido de clave RTDB '%s'",
    (char) => {
      expect(validateTeamName(`Spartans${char}Team`)).toBe("No puede contener . # $ [ ] /");
    },
  );

  it("acepta acentos, espacios y números (no son claves prohibidas)", () => {
    expect(validateTeamName("Peña Rugby 2026")).toBeNull();
  });
});

describe("CLUB_CATEGORIES", () => {
  it("espeja exactamente Club.CATEGORIES de Android", () => {
    expect(CLUB_CATEGORIES).toEqual([
      "Seniors",
      "Sub-21",
      "Sub-18",
      "Sub-16",
      "Sub-14",
      "Femenino",
      "Veteranos",
      "Otro",
    ]);
  });
});
