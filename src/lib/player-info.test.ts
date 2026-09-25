import { describe, expect, it } from "vitest";
import { describePositions, makeMain, positionFit, rankCandidates, togglePosition, type Candidate } from "./player-info";

describe("player-info", () => {
  it("togglePosition añade al final, quita y respeta el máximo de 5", () => {
    expect(togglePosition([], 10)).toEqual([10]);
    expect(togglePosition([10, 12], 10)).toEqual([12]);
    expect(togglePosition([1, 2, 3, 4, 5], 6)).toEqual([1, 2, 3, 4, 5]);
  });

  it("makeMain pone el puesto el primero", () => {
    expect(makeMain([10, 12, 15], 15)).toEqual([15, 10, 12]);
    expect(makeMain([10], 9)).toEqual([10]);
  });

  it("positionFit", () => {
    expect(positionFit({ positions: [10, 12] }, 10)).toBe("main");
    expect(positionFit({ positions: [10, 12] }, 12)).toBe("secondary");
    expect(positionFit({ positions: [10, 12] }, 1)).toBeNull();
  });

  it("rankCandidates: disponibles, principal, secundario, resto; lesionados al final", () => {
    const c = (name: string, positions: number[], injured = false): Candidate => ({
      uid: name,
      name,
      info: { positions, injured },
    });
    const ranked = rankCandidates(
      [c("Zoe", []), c("Ana", [12, 10]), c("Luis", [10]), c("Marc", [10], true), c("Bea", [])],
      10,
    );
    expect(ranked.map((x) => x.name)).toEqual(["Luis", "Ana", "Bea", "Zoe", "Marc"]);
  });

  it("describePositions", () => {
    expect(describePositions({ positions: [] })).toBe("");
    expect(describePositions({ positions: [10] })).toBe("Apertura");
    expect(describePositions({ positions: [10, 12, 15] })).toBe("Apertura · +2");
  });
});
