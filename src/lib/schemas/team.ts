// Fuente: _Team.kt y _TrainingDay.kt del repo Android.
// Notas: la clave de Teams/{teamname} es el nombre del equipo; trainingdays
// es un ARRAY embebido y cada TrainingDay lleva el _Training COMPLETO copiado.
// Rosters por uid (2026-09-04): userplayers/pendingplayers/accepted_players/
// declined_players eran listas de nameSurname (texto) — dos personas con el
// mismo nombre se confundían en aceptar/expulsar/asistencia. Ahora son mapas
// {uid: true}, como Team.coaches — el nombre para mostrar se resuelve en vivo
// vía publicProfiles (useProfilesByUid), nunca se guarda una copia congelada.
import { z } from "zod";
import { rtdbList, rtdbRecord } from "./common";
import { LineupDocSchema } from "./lineup";
import { TrainingSchema } from "./training";

export const TrainingDaySchema = z.object({
  fecha: z.string().nullish(), // "dd/MM/yyyy"
  horaInicio: z.string().nullish(), // "HH:mm"
  horaFin: z.string().nullish(),
  nameTrainingDay: z.string().nullish(),
  training: TrainingSchema.nullish(),
  accepted_players: rtdbRecord(z.literal(true)).default({}), // {uid: true}
  declined_players: rtdbRecord(z.literal(true)).default({}),
  // Campos aditivos (2026-07-13): null/"TRAINING" = entrenamiento, "MATCH" = partido.
  eventType: z.enum(["TRAINING", "MATCH"]).nullish(),
  location: z.string().nullish(),
  // Qué alineación (Teams/{team}/lineups/{lineupId}) es "la oficial" de
  // este partido — null/ausente = ninguna publicada todavía. Rediseño
  // 2026-09-03: antes era un objeto embebido (lineup), ahora una
  // referencia — permite varias alineaciones alternativas por partido
  // (Plan A/B) sin publicar más de una a la vez, y plantillas sin partido.
  lineupId: z.string().nullish(),
  // Evento cancelado (2026-09-23, solo web): sigue en el calendario con sus
  // respuestas pero no cuenta para asistencia. Android lo conserva al editar
  // (fusiona el día) aunque todavía no lo pinta.
  cancelled: z.boolean().nullish().catch(null),
});

/**
 * Datos por evento fuera de trainingdays (paso 2 Kanteo, 2026-09-25): Android
 * reescribe ese array entero, así que lo nuevo vive en
 * Teams/{t}/eventData/{yyyy-MM-dd}. Solo lo usa la web. Lectura tolerante:
 * los valores se interpretan en lib/attendance.ts (un valor raro no debe
 * tumbar el parseo del equipo entero).
 */
export const EventDataSchema = z.object({
  // Asistencia real al pasar lista: present | late | absent | injured | excused.
  attendance: z.record(z.string(), z.string()).default({}).catch({}),
});

export const TeamSchema = z.object({
  teamname: z.string().nullish(),
  usercoach: z.string().nullish(), // uid del coach fundador — sigue siendo "el dueño" (borrar equipo, no puede salir sin borrarlo)
  teamcode: z.string().nullish(),
  teamicon: z.string().nullish(),
  userplayers: rtdbRecord(z.literal(true)).default({}), // {uid: true}
  pendingplayers: rtdbRecord(z.literal(true)).default({}),
  trainingdays: rtdbList(TrainingDaySchema).default([]),
  clubId: z.string().nullish(),
  category: z.string().nullish(),
  lineups: z.record(z.string(), LineupDocSchema).default({}),
  // Varios entrenadores por equipo (rediseño 2026-09-03): mapa uid->true, no
  // array — RTDB no tiene "contains" sobre arrays, así que las reglas
  // comprueban pertenencia con .child(uid) (mismo truco que Clubs.pendingTeams).
  // Un co-entrenador NUNCA aparece en userplayers solo por serlo (a diferencia
  // del fundador, que sí, ver buildTeam) — coach y jugador son cosas distintas.
  coaches: rtdbRecord(z.literal(true)).default({}),
  pendingCoaches: rtdbRecord(z.literal(true)).default({}),
  eventData: z.record(z.string(), EventDataSchema).default({}).catch({}),
});
