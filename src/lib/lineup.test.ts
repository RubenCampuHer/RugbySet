import { describe, expect, it } from "vitest";
import {
  findDuplicateSlot,
  lineupSlots,
  nextBenchNumber,
  RUGBY_POSITIONS,
  slotsToStored,
  STARTER_POSITIONS,
} from "./lineup";

describe("RUGBY_POSITIONS / STARTER_POSITIONS", () => {
  it("tiene exactamente las 15 posiciones", () => {
    expect(STARTER_POSITIONS).toHaveLength(15);
    expect(STARTER_POSITIONS[0]).toBe(1);
    expect(STARTER_POSITIONS[14]).toBe(15);
    expect(RUGBY_POSITIONS[1]).toBe("Pilar izquierdo");
    expect(RUGBY_POSITIONS[15]).toBe("Zaguero");
  });
});

describe("nextBenchNumber", () => {
  it("empieza en 16 sin ningún número usado", () => {
    expect(nextBenchNumber([])).toBe(16);
  });

  it("continúa tras el número más alto ya usado, sin importar el orden", () => {
    expect(nextBenchNumber([16, 18, 17])).toBe(19);
  });
});

describe("puestos con uid", () => {
  it("lineupSlots solo se fía del uid si el nombre coincide", () => {
    const slots = lineupSlots({
      starters: { "1": "Ana", "2": "Nombre nuevo de Android", "3": "Sin cuenta" },
      bench: { "16": "Luis" },
      players: { "1": { uid: "u1", name: "Ana" }, "2": { uid: "u2", name: "Marc" }, "16": { uid: "u3", name: "Luis" } },
    });
    expect(slots.starters["1"]).toEqual({ name: "Ana", uid: "u1" });
    expect(slots.starters["2"]).toEqual({ name: "Nombre nuevo de Android", uid: null });
    expect(slots.starters["3"]).toEqual({ name: "Sin cuenta", uid: null });
    expect(slots.bench["16"]).toEqual({ name: "Luis", uid: "u3" });
  });

  it("slotsToStored guarda nombres y players solo para quien tiene cuenta", () => {
    expect(
      slotsToStored({
        starters: { "1": { name: " Ana ", uid: "u1" }, "2": { name: "Invitado", uid: null }, "3": { name: "", uid: null } },
        bench: {},
      }),
    ).toEqual({ starters: { "1": "Ana", "2": "Invitado" }, bench: {}, players: { "1": { uid: "u1", name: "Ana" } } });
  });

  it("findDuplicateSlot: homónimos con cuentas distintas no cuentan como repetidos", () => {
    expect(
      findDuplicateSlot({
        starters: { "1": { name: "Juan Pérez", uid: "a" }, "2": { name: "Juan Pérez", uid: "b" } },
        bench: {},
      }),
    ).toBeNull();
    expect(
      findDuplicateSlot({ starters: { "1": { name: "Ana", uid: "a" } }, bench: { "16": { name: "Ana", uid: "a" } } }),
    ).toBe("Ana");
    expect(
      findDuplicateSlot({ starters: { "1": { name: "Invitado", uid: null }, "2": { name: " invitado", uid: null } }, bench: {} }),
    ).toBe(" invitado");
  });
});
