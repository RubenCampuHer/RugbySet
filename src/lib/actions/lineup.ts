// Acciones de alineaciones — entidad propia desde el rediseño 2026-09-03
// (antes vivían embebidas en TrainingDay.lineup, una sola por partido).
// Viven en Teams/{teamname}/lineups/{lineupId}, hermana de trainingdays
// bajo el mismo nodo de equipo — mismo .write/.read de Teams/{teamname}
// que ya cubre todo lo demás, sin reglas RTDB nuevas.
import { push, ref, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import type { LineupDoc, TrainingDay } from "@/lib/types";

/** Crea una alineación nueva (plantilla suelta si matchFecha es null). */
export async function createLineup(
  teamname: string,
  data: { name: string; matchFecha: string | null },
): Promise<LineupDoc> {
  const lineupId = push(ref(db, `${PATHS.TEAMS}/${teamname}/lineups`)).key;
  if (!lineupId) throw new Error("No se pudo crear la alineación");
  const doc: LineupDoc = {
    lineupId,
    name: data.name.trim() || null,
    matchFecha: data.matchFecha,
    starters: {},
    bench: {},
    createdAt: Date.now(),
  };
  await update(ref(db, `${PATHS.TEAMS}/${teamname}/lineups/${lineupId}`), doc);
  return doc;
}

/** Actualiza nombre/fecha/titulares/banquillo de una alineación existente — merge parcial. */
export async function updateLineup(
  teamname: string,
  lineupId: string,
  patch: {
    name?: string;
    matchFecha?: string | null;
    starters?: Record<string, string>;
    bench?: Record<string, string>;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name.trim() || null;
  if (patch.matchFecha !== undefined) updates.matchFecha = patch.matchFecha;
  if (patch.starters !== undefined) updates.starters = patch.starters;
  if (patch.bench !== undefined) updates.bench = patch.bench;
  await update(ref(db, `${PATHS.TEAMS}/${teamname}/lineups/${lineupId}`), updates);
}

/**
 * Reconstruye un TrainingDay campo a campo (nunca `{...day}`) antes de
 * reescribir trainingdays entero — un día leído de RTDB puede traer algún
 * campo nullish ausente (undefined tras el parseo de Zod) si es antiguo, y
 * Firebase rechaza cualquier undefined en el objeto que se escribe. Mismo
 * criterio que upsertTrainingDay/el saveLineup anterior (ver team.ts).
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
 * Hace que `lineupId` sea LA alineación oficial de ese partido — publicarla.
 * Si el día no existe todavía en el calendario, lo crea (Partido mínimo,
 * horas por defecto). Si existe pero no es un Partido, se niega en vez de
 * pisar un Entrenamiento ya programado con su entreno adjunto.
 */
export async function publishLineup(
  teamname: string,
  lineupId: string,
  matchFecha: string,
  lineupName: string | null,
  existing: TrainingDay[],
): Promise<void> {
  const existingDay = existing.find((d) => d.fecha === matchFecha);
  if (existingDay && existingDay.eventType !== "MATCH") {
    throw new Error(
      "Ese día ya tiene un entreno programado — cámbialo a Partido desde el Calendario antes de publicar.",
    );
  }
  const newDay: TrainingDay = existingDay
    ? rebuildDay(existingDay, { lineupId })
    : {
        fecha: matchFecha,
        horaInicio: "18:00",
        horaFin: "19:30",
        nameTrainingDay: lineupName ?? "",
        training: null,
        eventType: "MATCH",
        location: null,
        accepted_players: [],
        declined_players: [],
        lineupId,
      };
  const rest = existing.filter((d) => d.fecha !== matchFecha);
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), {
    trainingdays: [...rest, newDay],
  });
}

/** Deja de mostrar una alineación al equipo para ese partido, sin borrarla (sigue en Borradores). */
export async function unpublishLineup(
  teamname: string,
  matchFecha: string,
  existing: TrainingDay[],
): Promise<void> {
  const existingDay = existing.find((d) => d.fecha === matchFecha);
  if (!existingDay) return;
  const newDay = rebuildDay(existingDay, { lineupId: null });
  const rest = existing.filter((d) => d.fecha !== matchFecha);
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), {
    trainingdays: [...rest, newDay],
  });
}

/**
 * Borra una alineación. Si algún partido la tenía publicada, limpia esa
 * referencia en la misma escritura multi-path para no dejarla colgando.
 */
export async function deleteLineup(
  teamname: string,
  lineupId: string,
  existing: TrainingDay[],
): Promise<void> {
  const updates: Record<string, unknown> = {
    [`lineups/${lineupId}`]: null,
  };
  const referencingDay = existing.find((d) => d.lineupId === lineupId);
  if (referencingDay?.fecha) {
    const newDay = rebuildDay(referencingDay, { lineupId: null });
    updates.trainingdays = [
      ...existing.filter((d) => d.fecha !== referencingDay.fecha),
      newDay,
    ];
  }
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), updates);
}
