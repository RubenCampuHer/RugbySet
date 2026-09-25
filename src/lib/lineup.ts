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

// ── Puestos con uid (2026-09-25) ──
// starters/bench guardan el NOMBRE (Android los lee); players[clave] = {uid,
// name} dice quién es. Solo se usa el uid si ese nombre sigue coincidiendo
// con el de starters/bench: si no, Android editó el puesto y manda el texto.

export type LineupSlot = { name: string; uid: string | null };
export type LineupSlots = { starters: Record<string, LineupSlot>; bench: Record<string, LineupSlot> };

type StoredLineup = {
  starters: Record<string, string>;
  bench: Record<string, string>;
  players: Record<string, { uid: string; name: string } | null>;
};

export function lineupSlots(lineup: StoredLineup): LineupSlots {
  const toSlots = (names: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(names)
        .filter(([, name]) => name)
        .map(([key, name]) => {
          const p = lineup.players[key];
          return [key, { name, uid: p && p.name === name ? p.uid : null }];
        }),
    );
  return { starters: toSlots(lineup.starters), bench: toSlots(lineup.bench) };
}

/** Lo que se guarda: nombres (para Android) + quién es cada puesto con cuenta. */
export function slotsToStored(slots: LineupSlots): StoredLineup {
  const names = (s: Record<string, LineupSlot>) =>
    Object.fromEntries(Object.entries(s).filter(([, v]) => v.name.trim()).map(([k, v]) => [k, v.name.trim()]));
  const players: StoredLineup["players"] = {};
  for (const [key, slot] of [...Object.entries(slots.starters), ...Object.entries(slots.bench)]) {
    if (slot.uid && slot.name.trim()) players[key] = { uid: slot.uid, name: slot.name.trim() };
  }
  return { starters: names(slots.starters), bench: names(slots.bench), players };
}

/** Primer puesto repetido (misma persona en dos puestos): por uid si tiene cuenta, si no por nombre. */
export function findDuplicateSlot(slots: LineupSlots): string | null {
  const seen = new Set<string>();
  for (const slot of [...Object.values(slots.starters), ...Object.values(slots.bench)]) {
    const key = slot.uid ? `uid:${slot.uid}` : `name:${slot.name.trim().toLowerCase()}`;
    if (key === "name:") continue;
    if (seen.has(key)) return slot.name;
    seen.add(key);
  }
  return null;
}
