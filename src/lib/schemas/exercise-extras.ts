// Vídeo y niveles de un ejercicio (2026-09-29, solo web). Nodo
// ExerciseExtras/{nombre del ejercicio} — ver database.rules.json del repo
// Android (bloque ExerciseExtras): las reglas validan la misma forma, así que
// un campo nuevo aquí va también allí. Aparte de Exercises/{n} porque las
// versiones de Android publicadas reescriben ese nodo entero al editar.
import { z } from "zod";
import { rtdbRecord } from "./common";

export const VideoRefSchema = z.object({
  source: z.enum(["link", "file"]),
  url: z.string(),
  /** Solo si source = "file": ruta en Storage (exercise_videos/{uid}/…) para borrarlo. */
  path: z.string().nullish(),
  title: z.string().nullish(),
});
export type VideoRef = z.infer<typeof VideoRefSchema>;

export const ExerciseLevelSchema = z.object({
  /** Nombre corto del nivel: "2v1", "Con oposición"… */
  name: z.string(),
  /** Qué cambia respecto al anterior. */
  desc: z.string().nullish(),
  order: z.number(),
  video: VideoRefSchema.nullish().catch(null),
});
export type ExerciseLevel = z.infer<typeof ExerciseLevelSchema>;

export const ExerciseExtrasSchema = z.object({
  /** Vídeo del ejercicio base. */
  video: VideoRefSchema.nullish().catch(null),
  // Un nivel roto se descarta en vez de tirar todos.
  levels: rtdbRecord(ExerciseLevelSchema.nullable().catch(null)).default({}),
  updatedAt: z.number().catch(0),
  updatedBy: z.string().catch(""),
});
export type ExerciseExtras = z.infer<typeof ExerciseExtrasSchema>;
