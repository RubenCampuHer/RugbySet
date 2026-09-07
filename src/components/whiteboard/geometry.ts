// Geometría pura de flechas/líneas de la pizarra (sin React, testeable).
// Una flecha/línea es recta (`M from L to`) o una Bézier cuadrática con un
// punto de control `ctrl` (`M from Q ctrl to`). El usuario nunca ve `ctrl`:
// arrastra el punto MEDIO de la curva y `ctrl` se deduce de él.
import type { Vec } from "./types";

/** Atributo `d` de un <path> para el segmento. */
export function segmentPathD(from: Vec, to: Vec, ctrl?: Vec): string {
  return ctrl
    ? `M ${from.x} ${from.y} Q ${ctrl.x} ${ctrl.y} ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

/** Punto medio de la cuerda from→to. */
export function chordMidpoint(from: Vec, to: Vec): Vec {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/**
 * Punto sobre la curva en t=0.5 — donde se pinta el tirador central.
 * B(0.5) = 0.25·from + 0.5·ctrl + 0.25·to. Sin ctrl coincide con la cuerda.
 */
export function curveMidpoint(from: Vec, to: Vec, ctrl?: Vec): Vec {
  if (!ctrl) return chordMidpoint(from, to);
  return {
    x: 0.25 * from.x + 0.5 * ctrl.x + 0.25 * to.x,
    y: 0.25 * from.y + 0.5 * ctrl.y + 0.25 * to.y,
  };
}

/** Inversa de curveMidpoint: el ctrl que hace pasar la curva por `mid` en t=0.5. */
export function ctrlFromMidpoint(from: Vec, to: Vec, mid: Vec): Vec {
  return {
    x: 2 * mid.x - 0.5 * (from.x + to.x),
    y: 2 * mid.y - 0.5 * (from.y + to.y),
  };
}

/**
 * Si la curva es casi recta (su punto medio queda a menos de `threshold` de la
 * cuerda), devuelve undefined para volver a recta y no guardar un ctrl inútil.
 */
export function snapStraight(from: Vec, to: Vec, ctrl: Vec, threshold: number): Vec | undefined {
  const mid = curveMidpoint(from, to, ctrl);
  const chord = chordMidpoint(from, to);
  return Math.hypot(mid.x - chord.x, mid.y - chord.y) < threshold ? undefined : ctrl;
}

/** Desplazamiento de `ctrl` respecto al centro de la cuerda — para conservar la curvatura al mover un extremo. */
export function ctrlOffset(from: Vec, to: Vec, ctrl: Vec): Vec {
  const chord = chordMidpoint(from, to);
  return { x: ctrl.x - chord.x, y: ctrl.y - chord.y };
}

/** Inversa de ctrlOffset sobre una cuerda nueva. */
export function ctrlFromOffset(from: Vec, to: Vec, offset: Vec): Vec {
  const chord = chordMidpoint(from, to);
  return { x: chord.x + offset.x, y: chord.y + offset.y };
}
