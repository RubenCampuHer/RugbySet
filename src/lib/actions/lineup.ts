// Acciones de alineaciones — entidad propia desde el rediseño 2026-09-03
// (antes vivían embebidas en TrainingDay.lineup, una sola por partido).
// Viven en Teams/{teamname}/lineups/{lineupId}, hermana de trainingdays
// bajo el mismo nodo de equipo — mismo .write/.read de Teams/{teamname}
// que ya cubre todo lo demás, sin reglas RTDB nuevas.
//
// La alineación (nombre + titulares + banquillo) y su asignación a un
// partido concreto son objetos distintos (aclarado por el usuario
// 2026-09-03): crear/editar/borrar una alineación vive en cualquier
// sitio (biblioteca en /team/lineups, o el propio Calendario); decidir
// QUÉ alineación es la de un partido concreto (assignLineupToMatch) es
// una acción exclusiva del Calendario — la alineación no sabe ni le
// importa a qué partido está asignada, esa referencia vive solo en
// TrainingDay.lineupId.
import { push, ref, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import type { LineupDoc, TrainingDay } from "@/lib/types";

/** Crea una alineación nueva — solo nombre, sin ningún partido asociado todavía. */
export async function createLineup(teamname: string, data: { name: string }): Promise<LineupDoc> {
  const lineupId = push(ref(db, `${PATHS.TEAMS}/${teamname}/lineups`)).key;
  if (!lineupId) throw new Error("No se pudo crear la alineación");
  const doc: LineupDoc = {
    lineupId,
    name: data.name.trim() || null,
    starters: {},
    bench: {},
    createdAt: Date.now(),
  };
  await update(ref(db, `${PATHS.TEAMS}/${teamname}/lineups/${lineupId}`), doc);
  return doc;
}

/** Actualiza nombre/titulares/banquillo de una alineación existente — merge parcial. */
export async function updateLineup(
  teamname: string,
  lineupId: string,
  patch: {
    name?: string;
    starters?: Record<string, string>;
    bench?: Record<string, string>;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name.trim() || null;
  if (patch.starters !== undefined) updates.starters = patch.starters;
  if (patch.bench !== undefined) updates.bench = patch.bench;
  await update(ref(db, `${PATHS.TEAMS}/${teamname}/lineups/${lineupId}`), updates);
}

/**
 * Reconstruye un TrainingDay campo a campo (nunca `{...day}`) antes de
 * reescribir trainingdays entero — un día leído de RTDB puede traer algún
 * campo nullish ausente (undefined tras el parseo de Zod) si es antiguo, y
 * Firebase rechaza cualquier undefined en el objeto que se escribe. Mismo
 * criterio que upsertTrainingDay (ver team.ts).
 */
function rebuildDay(day: TrainingDay, overrides: Partial<TrainingDay>): TrainingDay {
  return {
    fecha: day.fecha ?? null,
    horaInicio: day.horaInicio ?? null,
    horaFin: day.horaFin ?? null,
    nameTrainingDay: day.nameTrainingDay ?? "",
    training: day.training ?? null,
    eventType: day.eventType ?? "TRAINING",
    location: day.location ?? null,
    accepted_players: day.accepted_players,
    declined_players: day.declined_players,
    lineupId: day.lineupId ?? null,
    ...overrides,
  };
}

/**
 * Asigna (o quita, con lineupId=null) qué alineación es la de un partido
 * YA EXISTENTE en el calendario — acción exclusiva de DayPanel, que
 * siempre opera sobre un TrainingDay confirmado (nunca hace falta crear
 * el día aquí: si no existe, es un error de uso, no un caso a resolver).
 */
export async function assignLineupToMatch(
  teamname: string,
  fecha: string,
  lineupId: string | null,
  existing: TrainingDay[],
): Promise<void> {
  const existingDay = existing.find((d) => d.fecha === fecha);
  if (!existingDay) throw new Error(`No existe ningún partido el ${fecha}`);
  const newDay = rebuildDay(existingDay, { lineupId });
  const rest = existing.filter((d) => d.fecha !== fecha);
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), {
    trainingdays: [...rest, newDay],
  });
}

/**
 * Borra una alineación. Si algún partido (o varios — la misma alineación
 * puede reutilizarse en más de un partido) la tenía asignada, limpia esa
 * referencia en la misma escritura para no dejarla colgando.
 */
export async function deleteLineup(
  teamname: string,
  lineupId: string,
  existing: TrainingDay[],
): Promise<void> {
  const updates: Record<string, unknown> = {
    [`lineups/${lineupId}`]: null,
  };
  const referencingFechas = new Set(
    existing.filter((d) => d.lineupId === lineupId).map((d) => d.fecha),
  );
  if (referencingFechas.size > 0) {
    updates.trainingdays = existing.map((d) =>
      referencingFechas.has(d.fecha) ? rebuildDay(d, { lineupId: null }) : d,
    );
  }
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), updates);
}
