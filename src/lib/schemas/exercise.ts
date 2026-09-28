// Fuente: _Exercise.kt del repo Android — mantener en sincronía.
// Nota: la clave del nodo Exercises/{name} ES el nombre (no hay push ids).
import { z } from "zod";
import { AudienceSchema } from "../audience";
import { ApprovalStatusSchema, PrivacySchema, rtdbList, timestampMs } from "./common";

// Origen de una copia hecha con "Copiar a mis ejercicios/entrenos" (solo web;
// Android lo conserva al editar porque fusiona con el nodo existente).
export const CopiedFromSchema = z.object({
  name: z.string(),
  author: z.string().nullish(),
});

export const ExerciseSchema = z.object({
  name: z.string().nullish(),
  descCorta: z.string().nullish(),
  descLarga: z.string().nullish(),
  // URL de descarga de Storage con token — usable directamente en <img src>.
  image: z.string().nullish(),
  privacy: PrivacySchema.nullish(),
  // username del autor (no uid) — así lo guarda Android.
  author: z.string().nullish(),
  etiquetas: rtdbList(z.string()).default([]),
  created_at: timestampMs.nullish(),
  approvalStatus: ApprovalStatusSchema,
  // Solo presente cuando privacy === "Club" — snapshot del club del autor
  // en el momento de guardar (no se recalcula si el autor cambia de club
  // después, mismo criterio ya usado para teamname). teamname queda sin
  // uso real hoy (privacidad "Equipo" nunca se implementó) pero se
  // conserva por compatibilidad con el mirror de Android.
  teamname: z.string().nullish(),
  clubId: z.string().nullish(),
  // JSON serializado del estado de la pizarra (solo web, Android lo ignora
  // pero debe preservarlo al editar — ver _Exercise.kt).
  boardData: z.string().nullish(),
  copiedFrom: CopiedFromSchema.nullish().catch(null),
  // Público dentro del club (2026-09-28, solo web): con privacy "Club", quién
  // del club lo ve (lib/audience.ts). Ausente = todo el club. Android lo
  // ignora (lo ve todo el club) pero lo conserva al editar (fusiona el nodo).
  clubAudience: AudienceSchema.nullish().catch(null),
});
