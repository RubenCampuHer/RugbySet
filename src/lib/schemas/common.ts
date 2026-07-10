import { z } from "zod";

/**
 * Listas en RTDB: Firebase serializa las List<String> de Kotlin como array
 * denso, pero puede devolver `null` (lista vacía/ausente) u objeto con claves
 * numéricas y huecos (array disperso tras borrar índices). Este preprocess
 * normaliza los tres casos a un array limpio.
 */
export function rtdbList<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v.filter((x) => x != null);
    if (typeof v === "object") return Object.values(v).filter((x) => x != null);
    return [];
  }, z.array(item));
}

// Epoch-ms escritos por Kotlin (Long) — caben en Number sin pérdida.
export const timestampMs = z.number().int();

export const RoleSchema = z
  .enum(["ADMIN", "COACH", "PLAYER"])
  // Espeja el default del data class Kotlin (role: String? = "PLAYER") y
  // absorbe usuarios legacy sin rol o con valores corruptos.
  .catch("PLAYER");

export const PrivacySchema = z.enum(["Publico", "Privado", "Equipo"]);

// null = contenido legacy anterior al sistema de aprobación (visible solo
// para el autor, ver permissions.ts).
export const ApprovalStatusSchema = z
  .enum(["PENDING", "APPROVED", "REJECTED"])
  .nullish();

/**
 * safeParse tolerante: la RTDB tiene datos legacy reales (campos ausentes,
 * nulls). Un item corrupto se loguea y se descarta — nunca revienta la
 * página. `parse` estricto solo en tests.
 */
export function parseOr<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string,
): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[schema] ${context}:`, result.error.issues);
    return null;
  }
  return result.data;
}

/** Parsea un mapa RTDB {clave: item} a lista, descartando items corruptos. */
export function parseMapOr<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string,
): z.infer<T>[] {
  if (data == null || typeof data !== "object") return [];
  return Object.entries(data as Record<string, unknown>)
    .map(([key, value]) => parseOr(schema, value, `${context}/${key}`))
    .filter((x): x is z.infer<T> => x !== null);
}
