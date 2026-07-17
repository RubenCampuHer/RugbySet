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
  // Solo presente cuando privacy === "Equipo".
  teamname: z.string().nullish(),
  // JSON serializado del estado de la pizarra (solo web, Android lo ignora
  // pero debe preservarlo al editar — ver _Exercise.kt).
  boardData: z.string().nullish(),
});
