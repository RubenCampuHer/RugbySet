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
import { push, ref, remove, update } from "firebase/database";
import { mutateTrainingDays } from "@/lib/actions/team";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { mergeNode } from "@/lib/rtdb";
import { patchRawDay } from "@/lib/trainingdays";
import type { LineupDoc } from "@/lib/types";

/** Crea una alineación nueva — solo nombre, sin ningún partido asociado todavía. */
export async function createLineup(teamname: string, data: { name: string }): Promise<LineupDoc> {
  const lineupId = push(ref(db, `${PATHS.TEAMS}/${teamname}/lineups`)).key;
  if (!lineupId) throw new Error("No se pudo crear la alineación");
  const doc: LineupDoc = {
    lineupId,
    name: data.name.trim() || null,
    starters: {},
    bench: {},
    players: {},
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
    /** Quién es cada puesto (uid + nombre), solo web — ver schemas/lineup.ts. */
    players?: Record<string, { uid: string; name: string } | null>;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name.trim() || null;
  if (patch.starters !== undefined) updates.starters = patch.starters;
  if (patch.bench !== undefined) updates.bench = patch.bench;
  if (patch.players !== undefined) updates.players = patch.players;
  await update(ref(db, `${PATHS.TEAMS}/${teamname}/lineups/${lineupId}`), updates);
}

/**
 * Asigna (o quita, con lineupId=null) qué alineación es la de un partido
 * YA EXISTENTE en el calendario — acción exclusiva de DayPanel. Fusiona
 * sobre el dato crudo (ver mutateTrainingDays): no toca ningún otro campo.
 */
export async function assignLineupToMatch(
  teamname: string,
  fecha: string,
  lineupId: string | null,
): Promise<void> {
  await mutateTrainingDays(teamname, (days) => patchRawDay(days, fecha, { lineupId }));
}

/**
 * Borra una alineación. Si algún partido (o varios — la misma alineación
 * puede reutilizarse en más de un partido) la tenía asignada, limpia esa
 * referencia. Dos escrituras: la de trainingdays fusiona sobre el crudo.
 */
export async function deleteLineup(teamname: string, lineupId: string): Promise<void> {
  await mutateTrainingDays(teamname, (days) =>
    days.map((d) => (d.lineupId === lineupId ? mergeNode(d, { lineupId: null }) : d)),
  );
  await remove(ref(db, `${PATHS.TEAMS}/${teamname}/lineups/${lineupId}`));
}
