import { describe, expect, it } from "vitest";
import {
  CLUB_CATEGORIES,
  suggestTeamCode,
  validateClubName,
  validateTeamCode,
  validateTeamName,
} from "./team-validation";

describe("validateClubName", () => {
  it("un nombre válido no da error", () => {
    expect(validateClubName("Club Rugby Granollers")).toBeNull();
  });

  it("vacío o solo espacios es obligatorio", () => {
    expect(validateClubName("")).not.toBeNull();
    expect(validateClubName("   ")).not.toBeNull();
  });

  it("acepta caracteres de clave RTDB — el club no usa el nombre como clave", () => {
    expect(validateClubName("C.R. Sant Cugat / Sec. B")).toBeNull();
  });

  it("rechaza más de 80 caracteres", () => {
    expect(validateClubName("a".repeat(81))).not.toBeNull();
  });
});

describe("validateTeamName", () => {
  it("un nombre válido no da error", () => {
    expect(validateTeamName("Spartans")).toBeNull();
  });

  it("vacío o solo espacios explica que es obligatorio", () => {
    expect(validateTeamName("")).toBe("El nombre del equipo es obligatorio.");
    expect(validateTeamName("   ")).toBe("El nombre del equipo es obligatorio.");
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

describe("validateTeamCode", () => {
  it("un código válido no da error", () => {
    expect(validateTeamCode("SPARTANS482")).toBeNull();
  });

  it("vacío o solo espacios explica qué falta", () => {
    expect(validateTeamCode("")).toBe("Elige un código para tu equipo.");
    expect(validateTeamCode("   ")).toBe("Elige un código para tu equipo.");
  });
});

describe("suggestTeamCode", () => {
  it("mayúsculas + sufijo", () => {
    expect(suggestTeamCode("spartans", "482")).toBe("SPARTANS482");
  });

  it("quita espacios, tildes y símbolos", () => {
    // "Peña Rugby 2026!" -> sin tildes/espacios/símbolos: "PEARUGBY2026", cortado a 10 + sufijo.
    expect(suggestTeamCode("Peña Rugby 2026!", "482")).toBe("PEARUGBY20482");
  });

  it("corta el prefijo a 10 caracteres antes de añadir el sufijo", () => {
    expect(suggestTeamCode("Un Nombre Muy Largo De Equipo", "001")).toBe("UNNOMBREMU001");
  });

  it("nombre vacío o sin ningún carácter alfanumérico usa 'EQUIPO'", () => {
    expect(suggestTeamCode("", "482")).toBe("EQUIPO482");
    expect(suggestTeamCode("!!!", "482")).toBe("EQUIPO482");
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
