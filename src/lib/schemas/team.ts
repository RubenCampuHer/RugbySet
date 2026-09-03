// Fuente: _Team.kt y _TrainingDay.kt del repo Android.
// Notas: la clave de Teams/{teamname} es el nombre del equipo; userplayers y
// pendingplayers son listas de nameSurname (texto, no uids); trainingdays es
// un ARRAY embebido y cada TrainingDay lleva el _Training COMPLETO copiado.
import { z } from "zod";
import { rtdbList } from "./common";
import { TrainingSchema } from "./training";

// Alineación de un Partido — campo aditivo, sin equivalente en Android
// todavía (ver plan). RTDB borra las claves con valor null, así que un
// array de 15 posiciones con huecos perdería el índice/orden: se guarda
// como objeto por número de posición ("1".."15") o dorsal de banquillo
// ("16", "17"...) — solo aparecen las claves ya asignadas. El valor es
// texto libre (nombre del roster O escrito a mano para alguien sin
// cuenta) — ver src/lib/lineup.ts.
export const LineupSchema = z.object({
  published: z.boolean().default(false),
  starters: z.record(z.string(), z.string()).default({}),
  bench: z.record(z.string(), z.string()).default({}),
});

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
  lineup: LineupSchema.nullish(),
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
});
