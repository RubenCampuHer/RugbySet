// Acciones de gestión de equipo y calendario.
// ⚠️ Patrones de escritura CORRECTOS bajo database.rules.json — NO replicar
// la vía legacy Android (setValue del nodo Teams/Users completo), que está
// denegada en varios casos. Referencia: TeamRepository.kt (multi-path).
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
  update,
} from "firebase/database";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import type { Team, Training, TrainingDay } from "@/lib/types";

/** nameSurname → uid, vía publicProfiles (indexOn nameSurname). */
export async function resolveUidByName(nameSurname: string): Promise<string | null> {
  const snap = await get(
    query(
      ref(db, PATHS.PUBLIC_PROFILES),
      orderByChild("nameSurname"),
      equalTo(nameSurname),
    ),
  );
  let uid: string | null = null;
  snap.forEach((child) => {
    uid = child.key;
    return true; // primer resultado
  });
  return uid;
}

/**
 * Coach acepta a un pendiente — multi-path atómico (espejo de
 * TeamRepository.acceptPendingPlayer): sale de pendingplayers, entra en
 * userplayers y su Users/{uid}/teamname apunta al equipo. La vía legacy
 * Android nunca fijaba el teamname (guard de modifyUser).
 */
export async function acceptPendingPlayer(team: Team, playerName: string) {
  const teamname = team.teamname!;
  const playerUid = await resolveUidByName(playerName);
  if (!playerUid) throw new Error(`No se encontró el perfil de ${playerName}`);

  const pending = team.pendingplayers.filter((n) => n !== playerName);
  const players = team.userplayers.includes(playerName)
    ? team.userplayers
    : [...team.userplayers, playerName];

  await update(ref(db), {
    [`${PATHS.TEAMS}/${teamname}/pendingplayers`]: pending,
    [`${PATHS.TEAMS}/${teamname}/userplayers`]: players,
    [`${PATHS.USERS}/${playerUid}/teamname`]: teamname,
  });
}

/** Coach rechaza a un pendiente — escribe solo pendingplayers. */
export async function rejectPendingPlayer(team: Team, playerName: string) {
  await update(ref(db), {
    [`${PATHS.TEAMS}/${team.teamname}/pendingplayers`]:
      team.pendingplayers.filter((n) => n !== playerName),
  });
}

/**
 * Coach expulsa a un jugador — multi-path atómico (espejo de
 * TeamRepository.removePlayer): fuera de userplayers y se limpian su
 * teamname y asistencia (escrituras por hijo, permitidas al coach).
 */
export async function removePlayer(team: Team, playerName: string) {
  const teamname = team.teamname!;
  const playerUid = await resolveUidByName(playerName);
  const updates: Record<string, unknown> = {
    [`${PATHS.TEAMS}/${teamname}/userplayers`]: team.userplayers.filter(
      (n) => n !== playerName,
    ),
  };
  if (playerUid) {
    updates[`${PATHS.USERS}/${playerUid}/teamname`] = null;
    updates[`${PATHS.USERS}/${playerUid}/assistedTrainingDays`] = null;
  }
  await update(ref(db), updates);
}

/** Formato de fecha compartido con Android: "dd/MM/yyyy". */
export type AttendanceStatus = "accepted" | "declined";

/**
 * Confirmar/rechazar asistencia de un jugador en un día concreto.
 * Escribe SOLO las listas accepted/declined del día (regla nueva: cualquier
 * miembro del equipo) + el assistedTrainingDays del jugador (dueño, o coach
 * del equipo). Válido para el propio jugador y para el coach pasando lista.
 */
export async function setAttendance(opts: {
  teamname: string;
  fecha: string;
  playerName: string;
  playerUid: string;
  status: AttendanceStatus;
}) {
  const { teamname, fecha, playerName, playerUid, status } = opts;

  // Índice REAL del día en el array (puede ser disperso) — leer crudo.
  const daysSnap = await get(ref(db, `${PATHS.TEAMS}/${teamname}/trainingdays`));
  let idx: string | null = null;
  let rawDay: { accepted_players?: unknown; declined_players?: unknown } | null = null;
  daysSnap.forEach((child) => {
    if (child.child("fecha").val() === fecha) {
      idx = child.key;
      rawDay = child.val();
      return true;
    }
    return false;
  });
  if (idx === null || rawDay === null) throw new Error("Día de entreno no encontrado");

  const toList = (v: unknown): string[] =>
    v == null ? [] : Array.isArray(v) ? v.filter(Boolean) : Object.values(v as object).filter(Boolean) as string[];

  const current: { accepted_players?: unknown; declined_players?: unknown } = rawDay;
  const accepted = toList(current.accepted_players).filter((n) => n !== playerName);
  const declined = toList(current.declined_players).filter((n) => n !== playerName);
  if (status === "accepted") accepted.push(playerName);
  else declined.push(playerName);

  await update(ref(db, `${PATHS.TEAMS}/${teamname}/trainingdays`), {
    [`${idx}/accepted_players`]: accepted,
    [`${idx}/declined_players`]: declined,
  });

  // Asistencia personal (dd/MM/yyyy) — alimenta las estadísticas del perfil.
  const favSnap = await get(
    ref(db, `${PATHS.USERS}/${playerUid}/assistedTrainingDays`),
  );
  const days = toList(favSnap.val()).filter((d) => d !== fecha);
  if (status === "accepted") days.push(fecha);
  await update(ref(db, `${PATHS.USERS}/${playerUid}`), {
    assistedTrainingDays: days,
  });
}

/**
 * Coach crea/edita el día de entreno: upsert por fecha reescribiendo SOLO
 * Teams/{t}/trainingdays (espejo de TeamRepository.upsertTrainingDay).
 * El training va EMBEBIDO completo, como hace Android.
 */
export async function upsertTrainingDay(
  teamname: string,
  day: {
    fecha: string;
    horaInicio: string;
    horaFin: string;
    training: Training;
  },
  existing: TrainingDay[],
) {
  const newDay: TrainingDay = {
    fecha: day.fecha,
    horaInicio: day.horaInicio,
    horaFin: day.horaFin,
    nameTrainingDay: "",
    training: day.training,
    accepted_players:
      existing.find((d) => d.fecha === day.fecha)?.accepted_players ?? [],
    declined_players:
      existing.find((d) => d.fecha === day.fecha)?.declined_players ?? [],
  };
  const rest = existing.filter((d) => d.fecha !== day.fecha);
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), {
    trainingdays: [...rest, newDay],
  });
}

/**
 * Coach borra un día — reescribe trainingdays sin él y limpia la fecha del
 * assistedTrainingDays de cada jugador que había confirmado (escritura por
 * hijo — la vía legacy Android con setValue del User completo estaba
 * denegada y dejaba asistencias huérfanas).
 */
export async function deleteTrainingDay(
  teamname: string,
  fecha: string,
  existing: TrainingDay[],
) {
  const day = existing.find((d) => d.fecha === fecha);
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), {
    trainingdays: existing.filter((d) => d.fecha !== fecha),
  });
  for (const name of day?.accepted_players ?? []) {
    const uid = await resolveUidByName(name);
    if (!uid) continue;
    const snap = await get(ref(db, `${PATHS.USERS}/${uid}/assistedTrainingDays`));
    const v = snap.val();
    const days = (v == null ? [] : Array.isArray(v) ? v : Object.values(v)).filter(
      (d) => d !== fecha,
    );
    await update(ref(db, `${PATHS.USERS}/${uid}`), { assistedTrainingDays: days });
  }
}

/** Unirse a un equipo por código — escribe SOLO pendingplayers (auth ✓). */
export async function requestJoinTeam(teamname: string, playerName: string) {
  const snap = await get(ref(db, `${PATHS.TEAMS}/${teamname}/pendingplayers`));
  const v = snap.val();
  const pending = (
    v == null ? [] : Array.isArray(v) ? v : Object.values(v)
  ).filter(Boolean) as string[];
  if (!pending.includes(playerName)) pending.push(playerName);
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), {
    pendingplayers: pending,
  });
}
