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

/**
 * Forma mínima que necesitan estas utilidades — no el LineupDoc completo
 * (que además lleva lineupId/name/matchFecha) — para poder llamarlas
 * también sobre el estado local en edición de LineupEditor, sin tener que
 * reconstruir un doc completo en cada tecla.
 */
export type RosterAssignments = {
  starters: Record<string, string>;
  bench: Record<string, string>;
};

const EMPTY: RosterAssignments = { starters: {}, bench: {} };

/**
 * Nombres ya asignados en la alineación (titulares + banquillo), para
 * excluirlos de los desplegables de las demás filas. `excludeKey` es la
 * propia clave de la fila que se está editando ("1".."15" o el dorsal de
 * banquillo) — así su valor actual sigue apareciendo como opción en su
 * propio Select en vez de desaparecer.
 */
export function takenNames(assignments: RosterAssignments | null | undefined, excludeKey?: string): Set<string> {
  const a = assignments ?? EMPTY;
  const names = new Set<string>();
  for (const [key, name] of Object.entries(a.starters)) {
    if (key !== excludeKey && name) names.add(name);
  }
  for (const [key, name] of Object.entries(a.bench)) {
    if (key !== excludeKey && name) names.add(name);
  }
  return names;
}

/**
 * Siguiente dorsal de banquillo libre (16, 17…) al pulsar "Añadir suplente".
 * Recibe los números YA VISIBLES en el editor (no las claves de
 * lineup.bench): una fila de banquillo añadida pero sin nombre asignado
 * todavía no tiene clave en `bench` (RTDB no persiste vacíos), así que
 * derivar el siguiente número solo de `bench` repetiría un número ya en
 * pantalla — ver LineupEditor.benchOrder.
 */
export function nextBenchNumber(usedNumbers: number[]): number {
  return usedNumbers.length === 0 ? 16 : Math.max(...usedNumbers) + 1;
}

/**
 * Primer nombre duplicado en la alineación (dos filas distintas con la
 * misma persona), o null si no hay ninguno. takenNames ya evita elegir dos
 * veces del roster en el Select, pero un nombre escrito a mano en dos
 * filas distintas no pasa por ningún roster que lo impida — se valida
 * aquí, al guardar. Comparación sin mayúsculas ni espacios extra (mismo
 * "Juan Pérez" escrito con distinto formato en dos filas también cuenta).
 */
export function findDuplicateName(assignments: RosterAssignments): string | null {
  const seen = new Set<string>();
  for (const name of [...Object.values(assignments.starters), ...Object.values(assignments.bench)]) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}
