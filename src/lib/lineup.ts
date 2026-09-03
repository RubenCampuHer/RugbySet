import type { Lineup } from "./types";

/** Las 15 posiciones de rugby union, en orden. */
export const RUGBY_POSITIONS: Record<number, string> = {
  1: "Pilar izquierdo",
  2: "Talonador",
  3: "Pilar derecho",
  4: "Segunda línea",
  5: "Segunda línea",
  6: "Ala (flanquer)",
  7: "Ala (flanquer)",
  8: "Octavo",
  9: "Medio melé",
  10: "Apertura",
  11: "Ala (wing)",
  12: "Centro",
  13: "Centro",
  14: "Ala (wing)",
  15: "Zaguero",
};

export const STARTER_POSITIONS = Object.keys(RUGBY_POSITIONS).map(Number);

const EMPTY_LINEUP: Lineup = { published: false, starters: {}, bench: {} };

/**
 * Nombres ya asignados en la alineación (titulares + banquillo), para
 * excluirlos de los desplegables de las demás filas. `excludeKey` es la
 * propia clave de la fila que se está editando ("1".."15" o el dorsal de
 * banquillo) — así su valor actual sigue apareciendo como opción en su
 * propio Select en vez de desaparecer.
 */
export function takenNames(lineup: Lineup | null | undefined, excludeKey?: string): Set<string> {
  const l = lineup ?? EMPTY_LINEUP;
  const names = new Set<string>();
  for (const [key, name] of Object.entries(l.starters)) {
    if (key !== excludeKey && name) names.add(name);
  }
  for (const [key, name] of Object.entries(l.bench)) {
    if (key !== excludeKey && name) names.add(name);
  }
  return names;
}

/** Siguiente dorsal de banquillo libre (16, 17…) al pulsar "Añadir suplente". */
export function nextBenchNumber(lineup: Lineup | null | undefined): number {
  const keys = Object.keys((lineup ?? EMPTY_LINEUP).bench).map(Number);
  return keys.length === 0 ? 16 : Math.max(...keys) + 1;
}
