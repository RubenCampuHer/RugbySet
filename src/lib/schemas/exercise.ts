// Fuente: _Exercise.kt del repo Android — mantener en sincronía.
// Nota: la clave del nodo Exercises/{name} ES el nombre (no hay push ids).
import { z } from "zod";
import { ApprovalStatusSchema, PrivacySchema, rtdbList, timestampMs } from "./common";

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
});
