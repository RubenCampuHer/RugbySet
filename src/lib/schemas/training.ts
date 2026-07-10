// Fuente: _Training.kt, _Section.kt y _ExerciseTraining.kt del repo Android.
// Nota: cada ExerciseTraining EMBEBE el objeto Exercise completo (copia, no
// referencia) — no hay que resolver contra Exercises/.
import { z } from "zod";
import { ApprovalStatusSchema, PrivacySchema, rtdbList, timestampMs } from "./common";
import { ExerciseSchema } from "./exercise";

export const ExerciseTrainingSchema = z.object({
  exercise: ExerciseSchema.nullish(),
  tiempoExercise: z.number().int().catch(0),
  order: z.number().int().catch(0),
});

export const SectionSchema = z.object({
  sectionName: z.string().catch(""),
  tiempoSeccion: z.number().int().catch(0),
  exercises: rtdbList(ExerciseTrainingSchema).default([]),
  uid: z.string().nullish(),
});

export const TrainingSchema = z.object({
  name: z.string().nullish(),
  descCorta: z.string().nullish(),
  tiempoTotal: z.string().nullish(),
  sections: rtdbList(SectionSchema).default([]),
  privacy: PrivacySchema.nullish(),
  author: z.string().nullish(),
  etiquetas: rtdbList(z.string()).default([]),
  created_at: timestampMs.nullish(),
  approvalStatus: ApprovalStatusSchema,
  teamname: z.string().nullish(),
});
