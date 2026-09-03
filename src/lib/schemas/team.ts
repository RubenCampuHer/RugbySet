// Fuente: _Team.kt y _TrainingDay.kt del repo Android.
// Notas: la clave de Teams/{teamname} es el nombre del equipo; userplayers y
// pendingplayers son listas de nameSurname (texto, no uids); trainingdays es
// un ARRAY embebido y cada TrainingDay lleva el _Training COMPLETO copiado.
import { z } from "zod";
import { rtdbList } from "./common";
import { LineupDocSchema } from "./lineup";
import { TrainingSchema } from "./training";

export const TrainingDaySchema = z.object({
  fecha: z.string().nullish(), // "dd/MM/yyyy"
  horaInicio: z.string().nullish(), // "HH:mm"
  horaFin: z.string().nullish(),
  nameTrainingDay: z.string().nullish(),
  training: TrainingSchema.nullish(),
  accepted_players: rtdbList(z.string()).default([]), // nameSurname
  declined_players: rtdbList(z.string()).default([]),
  // Campos aditivos (2026-07-13): null/"TRAINING" = entrenamiento, "MATCH" = partido.
  eventType: z.enum(["TRAINING", "MATCH"]).nullish(),
  location: z.string().nullish(),
  // Qué alineación (Teams/{team}/lineups/{lineupId}) es "la oficial" de
  // este partido — null/ausente = ninguna publicada todavía. Rediseño
  // 2026-09-03: antes era un objeto embebido (lineup), ahora una
  // referencia — permite varias alineaciones alternativas por partido
  // (Plan A/B) sin publicar más de una a la vez, y plantillas sin partido.
  lineupId: z.string().nullish(),
});

export const TeamSchema = z.object({
  teamname: z.string().nullish(),
  usercoach: z.string().nullish(), // uid del coach
  teamcode: z.string().nullish(),
  teamicon: z.string().nullish(),
  userplayers: rtdbList(z.string()).default([]),
  pendingplayers: rtdbList(z.string()).default([]),
  trainingdays: rtdbList(TrainingDaySchema).default([]),
  clubId: z.string().nullish(),
  category: z.string().nullish(),
  lineups: z.record(z.string(), LineupDocSchema).default({}),
});
