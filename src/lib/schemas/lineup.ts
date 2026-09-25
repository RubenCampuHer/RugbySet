// Alineación como entidad propia, desacoplada del partido (rediseño
// 2026-09-03 — antes vivía embebida en TrainingDay.lineup, una sola por
// partido; ver plan). Vive en Teams/{teamname}/lineups/{lineupId}, hermana
// de trainingdays bajo el mismo nodo de equipo ya leído entero y en tiempo
// real por useTeam() — sin reglas RTDB nuevas.
//
// La alineación NO sabe a qué partido está asignada (aclarado por el
// usuario 2026-09-03: son objetos distintos) — esa referencia vive solo en
// TrainingDay.lineupId, y esa asignación es una acción exclusiva del
// Calendario (ver actions/lineup.ts → assignLineupToMatch). Por eso este
// doc no lleva ningún campo de fecha.
//
// starters/bench: objeto por número de posición ("1".."15") o dorsal de
// banquillo ("16", "17"...). ⚠️ RTDB devuelve esto como ARRAY (con `null`
// en los huecos) en vez de objeto en cuanto hay 2+ claves puramente
// numéricas — comportamiento conocido de Realtime Database, no un bug de
// escritura — por eso se parsea con rtdbRecord (normaliza ambas formas).
// Solo aparecen las posiciones ya asignadas. El valor es texto libre
// (nombre del roster o escrito a mano para alguien sin cuenta) — ver
// src/lib/lineup.ts.
//
// Sin equivalente en Android todavía (backlog).
import { z } from "zod";
import { rtdbRecord } from "./common";

export const LineupDocSchema = z.object({
  lineupId: z.string().nullish(),
  /** Etiqueta libre: "Plan A", "Titular vs Leones RC"... */
  name: z.string().nullish(),
  starters: rtdbRecord(z.string()).default({}),
  bench: rtdbRecord(z.string()).default({}),
  createdAt: z.number().nullish(),
  // Quién es cada puesto (2026-09-25, solo web): {clave: {uid, name}}. starters/
  // bench siguen llevando el nombre (Android los lee y los reescribe con
  // updateChildren, sin tocar este campo). La web solo se fía del uid si el
  // nombre guardado aquí coincide con el de starters/bench — si no, Android
  // cambió ese puesto y manda el texto.
  players: rtdbRecord(z.object({ uid: z.string(), name: z.string() }).nullable().catch(null)).default({}).catch({}),
});
