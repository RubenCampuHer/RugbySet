import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, parseBoardData, serializeBoardData, type BoardState } from "./types";

describe("parseBoardData", () => {
  it("acepta un board legado sin ctrl (flechas rectas)", () => {
    const raw = JSON.stringify({
      version: 1,
      objects: [
        { id: "a", kind: "arrow", style: "run", from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
        { id: "l", kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
      ],
    });
    const state = parseBoardData(raw);
    expect(state.objects).toHaveLength(2);
    expect(state.objects[0]).not.toHaveProperty("ctrl");
  });

  it("acepta y conserva ctrl en flechas y líneas", () => {
    const state: BoardState = {
      version: 1,
      objects: [
        {
          id: "a",
          kind: "arrow",
          style: "pass",
          from: { x: 0, y: 0 },
          to: { x: 10, y: 10 },
          ctrl: { x: 5, y: -20 },
        },
        { id: "l", kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 10 }, ctrl: { x: 5, y: 20 } },
      ],
    };
    expect(parseBoardData(serializeBoardData(state))).toEqual(state);
  });

  it("un ctrl malformado invalida el board (abre vacío) en vez de lanzar", () => {
    const raw = JSON.stringify({
      version: 1,
      objects: [{ id: "a", kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, ctrl: { x: "no" } }],
    });
    expect(parseBoardData(raw)).toEqual(EMPTY_BOARD);
  });

  it("no serializa ctrl ausente", () => {
    const raw = serializeBoardData({
      version: 1,
      objects: [{ id: "l", kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }],
    });
    expect(raw).not.toContain("ctrl");
  });
});
