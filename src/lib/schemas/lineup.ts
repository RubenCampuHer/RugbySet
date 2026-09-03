// Alineación como entidad propia, desacoplada del partido (rediseño
// 2026-09-03 — antes vivía embebida en TrainingDay.lineup, una sola por
// partido; ver plan). Vive en Teams/{teamname}/lineups/{lineupId}, hermana
// de trainingdays bajo el mismo nodo de equipo ya leído entero y en tiempo
// real por useTeam() — sin reglas RTDB nuevas.
//
// starters/bench: objeto por número de posición ("1".."15") o dorsal de
// banquillo ("16", "17"...), no array — RTDB borra las claves con valor
// null, así que un array con huecos perdería el índice/orden. Solo
// aparecen las posiciones ya asignadas. El valor es texto libre (nombre
// del roster o escrito a mano para alguien sin cuenta) — ver
// src/lib/lineup.ts.
//
// Sin equivalente en Android todavía (backlog).
import { z } from "zod";

export const LineupDocSchema = z.object({
  lineupId: z.string().nullish(),
  /** Etiqueta libre: "Plan A", "Titular vs Leones RC"... */
  name: z.string().nullish(),
  /** "dd/MM/yyyy" del partido al que pertenece, o ausente = plantilla suelta sin fecha. */
  matchFecha: z.string().nullish(),
  starters: z.record(z.string(), z.string()).default({}),
  bench: z.record(z.string(), z.string()).default({}),
  createdAt: z.number().nullish(),
});
