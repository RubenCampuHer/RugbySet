import { describe, expect, it } from "vitest";
import {
  chordMidpoint,
  ctrlFromMidpoint,
  ctrlFromOffset,
  ctrlOffset,
  curveMidpoint,
  segmentPathD,
  snapStraight,
} from "./geometry";

const from = { x: 100, y: 200 };
const to = { x: 500, y: 200 };

describe("segmentPathD", () => {
  it("recta sin ctrl", () => {
    expect(segmentPathD(from, to)).toBe("M 100 200 L 500 200");
  });
  it("Bézier cuadrática con ctrl", () => {
    expect(segmentPathD(from, to, { x: 300, y: 0 })).toBe("M 100 200 Q 300 0 500 200");
  });
});

describe("curveMidpoint / ctrlFromMidpoint", () => {
  it("sin ctrl el punto medio es el de la cuerda", () => {
    expect(curveMidpoint(from, to)).toEqual(chordMidpoint(from, to));
    expect(curveMidpoint(from, to)).toEqual({ x: 300, y: 200 });
  });
  it("son inversas: el tirador queda exactamente donde se soltó", () => {
    const mid = { x: 320, y: 60 };
    const ctrl = ctrlFromMidpoint(from, to, mid);
    expect(curveMidpoint(from, to, ctrl)).toEqual(mid);
  });
  it("ctrl en la cuerda produce el punto medio de la cuerda", () => {
    expect(ctrlFromMidpoint(from, to, { x: 300, y: 200 })).toEqual({ x: 300, y: 200 });
  });
});

describe("snapStraight", () => {
  it("vuelve a recta si el medio está muy cerca de la cuerda", () => {
    const ctrl = ctrlFromMidpoint(from, to, { x: 300, y: 205 });
    expect(snapStraight(from, to, ctrl, 12)).toBeUndefined();
  });
  it("conserva el ctrl si la curva es apreciable", () => {
    const ctrl = ctrlFromMidpoint(from, to, { x: 300, y: 260 });
    expect(snapStraight(from, to, ctrl, 12)).toEqual(ctrl);
  });
});

describe("ctrlOffset / ctrlFromOffset", () => {
  it("al mover un extremo la curvatura se conserva respecto a la nueva cuerda", () => {
    const ctrl = { x: 300, y: 0 };
    const offset = ctrlOffset(from, to, ctrl);
    expect(offset).toEqual({ x: 0, y: -200 });
    const newTo = { x: 900, y: 600 };
    expect(ctrlFromOffset(from, newTo, offset)).toEqual({ x: 500, y: 200 });
  });
});
