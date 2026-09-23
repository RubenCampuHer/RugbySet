// Utilidades de escritura RTDB que conservan lo que este código no conoce.
//
// Los schemas Zod eliminan claves no declaradas al parsear, así que NUNCA se
// debe reescribir un nodo a partir de datos parseados: Android, las Cloud
// Functions o una versión futura de la web pueden haber guardado hijos que
// aquí no existen (p. ej. `stability` en Exercises). Se lee el nodo CRUDO
// (`snap.val()`) y se fusiona solo lo que el editor cambia — mismo criterio
// que `RtdbParsing.mergeNode` en el repo Android.

type RawNode = Record<string, unknown>;

function isRecord(v: unknown): v is RawNode {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Port de `RtdbParsing.mergeNode` (Android): parte del nodo crudo existente y
 * aplica `overlay` encima. Un valor `null`/`undefined` en el overlay BORRA la
 * clave; el resto la sustituye. Las claves que el overlay no menciona se
 * conservan tal cual.
 */
export function mergeNode(existingRaw: unknown, overlay: Record<string, unknown>): RawNode {
  const out: RawNode = {};
  if (isRecord(existingRaw)) {
    for (const [k, v] of Object.entries(existingRaw)) out[k] = v;
  }
  for (const [k, v] of Object.entries(overlay)) {
    if (v === null || v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

/**
 * Lista cruda de RTDB (array o mapa numérico disperso) → array de nodos, en
 * orden de índice, sin huecos. Los elementos que no son objetos se descartan.
 */
export function rawList(value: unknown): RawNode[] {
  if (value == null) return [];
  const items = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.keys(value)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => value[k])
      : [];
  return items.filter(isRecord);
}
