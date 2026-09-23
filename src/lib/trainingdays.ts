// Transformaciones PURAS sobre la lista CRUDA de Teams/{t}/trainingdays.
//
// Android reescribe el array entero pero fusiona cada día con el existente
// (TeamRepository.upsertTrainingDay + RtdbParsing.mergeNode), conservando
// claves que no conoce. La web hacía lo contrario: reconstruía los días desde
// datos parseados por Zod, que elimina claves no declaradas, y borraba
// cualquier campo nuevo de TODOS los días al guardar uno. Estas funciones
// trabajan siempre sobre `snap.val()` sin parsear; ver
// lib/actions/trainingdays.ts para la lectura/escritura.
import { mergeNode, rawList } from "@/lib/rtdb";

export type RawDay = Record<string, unknown>;

export function findRawDay(days: RawDay[], fecha: string): RawDay | undefined {
  return days.find((d) => d.fecha === fecha);
}

/**
 * Crea o fusiona el día `fecha` con `overlay` (null borra la clave). El día
 * editado va al final, igual que Android (`rest + merged`).
 */
export function upsertRawDay(
  days: RawDay[],
  fecha: string,
  overlay: Record<string, unknown>,
): RawDay[] {
  const existing = findRawDay(days, fecha);
  const merged = mergeNode(existing, { ...overlay, fecha });
  return [...days.filter((d) => d.fecha !== fecha), merged];
}

/** Fusiona `overlay` en el día existente sin cambiar el orden; error si no existe. */
export function patchRawDay(
  days: RawDay[],
  fecha: string,
  overlay: Record<string, unknown>,
): RawDay[] {
  if (!findRawDay(days, fecha)) throw new Error(`No existe ningún evento el ${fecha}`);
  return days.map((d) => (d.fecha === fecha ? mergeNode(d, overlay) : d));
}

export function removeRawDay(days: RawDay[], fecha: string): RawDay[] {
  return days.filter((d) => d.fecha !== fecha);
}

export { rawList as rawDays };
