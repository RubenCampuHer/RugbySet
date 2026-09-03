import { describe, expect, it } from "vitest";
import {
  findDuplicateName,
  nextBenchNumber,
  RUGBY_POSITIONS,
  STARTER_POSITIONS,
  takenNames,
} from "./lineup";
import type { Lineup } from "./types";

describe("RUGBY_POSITIONS / STARTER_POSITIONS", () => {
  it("tiene exactamente las 15 posiciones", () => {
    expect(STARTER_POSITIONS).toHaveLength(15);
    expect(STARTER_POSITIONS[0]).toBe(1);
    expect(STARTER_POSITIONS[14]).toBe(15);
    expect(RUGBY_POSITIONS[1]).toBe("Pilar izquierdo");
    expect(RUGBY_POSITIONS[15]).toBe("Zaguero");
  });
});

describe("takenNames", () => {
  it("sin alineación (undefined/null) no hay nadie asignado", () => {
    expect(takenNames(undefined)).toEqual(new Set());
    expect(takenNames(null)).toEqual(new Set());
  });

  it("junta titulares + banquillo", () => {
    const lineup: Lineup = {
      published: false,
      starters: { "1": "Juan Pérez", "9": "Ana García" },
      bench: { "16": "Marc López" },
    };
    expect(takenNames(lineup)).toEqual(new Set(["Juan Pérez", "Ana García", "Marc López"]));
  });

  it("excludeKey deja fuera solo esa fila (su propio valor sigue disponible en su Select)", () => {
    const lineup: Lineup = {
      published: false,
      starters: { "1": "Juan Pérez" },
      bench: {},
    };
    expect(takenNames(lineup, "1")).toEqual(new Set());
    expect(takenNames(lineup, "9")).toEqual(new Set(["Juan Pérez"]));
  });

  it("un nombre manual repetido en dos filas cuenta igual que uno del roster", () => {
    const lineup: Lineup = {
      published: false,
      starters: { "1": "Invitado Sin Cuenta" },
      bench: {},
    };
    expect(takenNames(lineup, "9").has("Invitado Sin Cuenta")).toBe(true);
  });
});

describe("findDuplicateName", () => {
  it("sin duplicados devuelve null", () => {
    const lineup: Lineup = {
      published: false,
      starters: { "1": "Juan Pérez", "9": "Ana García" },
      bench: { "16": "Marc López" },
    };
    expect(findDuplicateName(lineup)).toBeNull();
  });

  it("detecta el mismo nombre manual repetido en dos filas (titular y banquillo)", () => {
    const lineup: Lineup = {
      published: false,
      starters: { "1": "Invitado Sin Cuenta" },
      bench: { "16": "Invitado Sin Cuenta" },
    };
    expect(findDuplicateName(lineup)).toBe("Invitado Sin Cuenta");
  });

  it("ignora mayúsculas y espacios extra al comparar", () => {
    const lineup: Lineup = {
      published: false,
      starters: { "1": "Juan Pérez", "2": "  juan pérez  " },
      bench: {},
    };
    expect(findDuplicateName(lineup)).not.toBeNull();
  });

  it("no confunde huecos vacíos entre sí (nunca hay strings vacíos en starters/bench en la práctica, pero por si acaso)", () => {
    const lineup: Lineup = {
      published: false,
      starters: { "1": "", "2": "" },
      bench: {},
    };
    expect(findDuplicateName(lineup)).toBeNull();
  });
});

describe("nextBenchNumber", () => {
  it("empieza en 16 con el banquillo vacío", () => {
    expect(nextBenchNumber(undefined)).toBe(16);
    expect(nextBenchNumber({ published: false, starters: {}, bench: {} })).toBe(16);
  });

  it("continúa tras el dorsal más alto ya asignado, sin importar el orden de inserción", () => {
    const lineup: Lineup = {
      published: false,
      starters: {},
      bench: { "16": "Ana", "18": "Marc", "17": "Juan" },
    };
    expect(nextBenchNumber(lineup)).toBe(19);
  });
});
