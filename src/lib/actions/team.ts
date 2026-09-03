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
import { httpsCallable } from "firebase/functions";
import { PATHS } from "@/lib/constants";
import { db, functions } from "@/lib/firebase";
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
 * Un coach (fundador o co-entrenador) acepta una solicitud de co-entrenador
 * — multi-path atómico, mismo patrón que acceptPendingPlayer: sale de
 * pendingCoaches, entra en coaches y su Users/{uid}/teamname apunta al
 * equipo. A diferencia de un jugador, NUNCA entra en userplayers.
 */
export async function acceptPendingCoach(team: Team, uid: string) {
  const teamname = team.teamname!;
  await update(ref(db), {
    [`${PATHS.TEAMS}/${teamname}/pendingCoaches/${uid}`]: null,
    [`${PATHS.TEAMS}/${teamname}/coaches/${uid}`]: true,
    [`${PATHS.USERS}/${uid}/teamname`]: teamname,
  });
}

/** Rechaza una solicitud de co-entrenador — solo limpia pendingCoaches. */
export async function rejectPendingCoach(team: Team, uid: string) {
  await update(ref(db), {
    [`${PATHS.TEAMS}/${team.teamname}/pendingCoaches/${uid}`]: null,
  });
}

/**
 * El fundador quita a un co-entrenador — no al revés (para dejar de ser
 * co-entrenador, ver leaveTeam) y nunca al propio fundador (para eso está
 * eliminar el equipo). Limpia también su teamname, igual que removePlayer.
 */
export async function removeCoach(team: Team, uid: string) {
  const teamname = team.teamname!;
  await update(ref(db), {
    [`${PATHS.TEAMS}/${teamname}/coaches/${uid}`]: null,
    [`${PATHS.USERS}/${uid}/teamname`]: null,
    [`${PATHS.USERS}/${uid}/assistedTrainingDays`]: null,
  });
}

/**
 * Un jugador YA en el roster se sube a co-entrenador de un tirón — sin pasar
 * por pendingCoaches (el coach que lo asciende ya lo conoce, no hace falta
 * que "se solicite" a sí mismo). Sale de userplayers, entra en coaches.
 */
export async function promoteToCoach(team: Team, playerName: string) {
  const teamname = team.teamname!;
  const uid = await resolveUidByName(playerName);
  if (!uid) throw new Error(`No se encontró el perfil de ${playerName}`);
  await update(ref(db), {
    [`${PATHS.TEAMS}/${teamname}/userplayers`]: team.userplayers.filter((n) => n !== playerName),
    [`${PATHS.TEAMS}/${teamname}/coaches/${uid}`]: true,
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
 *
 * nameTrainingDay/eventType/location son aditivos (2026-07-13, ver
 * TrainingDay.kt): antes nameTrainingDay siempre se guardaba "" — ahora se
 * persiste el valor real si se pasa.
 *
 * `training` es opcional: un Partido puede no llevar ningún entreno
 * adjunto (Android ya lo permitía, la web lo forzaba solo en la UI — ver
 * EventEditorSheet). `lineupId` (referencia a Teams/{team}/lineups/{id},
 * ver lib/actions/lineup.ts) se preserva del día existente igual que
 * accepted_players/declined_players — este upsert lo usa el editor de
 * evento (horas/ubicación/entreno), que nunca toca qué alineación está
 * publicada.
 */
export async function upsertTrainingDay(
  teamname: string,
  day: {
    fecha: string;
    horaInicio: string;
    horaFin: string;
    training?: Training;
    nameTrainingDay?: string;
    eventType?: "TRAINING" | "MATCH";
    location?: string | null;
  },
  existing: TrainingDay[],
) {
  const existingDay = existing.find((d) => d.fecha === day.fecha);
  const newDay: TrainingDay = {
    fecha: day.fecha,
    horaInicio: day.horaInicio,
    horaFin: day.horaFin,
    nameTrainingDay: day.nameTrainingDay ?? "",
    // Firebase (update/set) RECHAZA cualquier `undefined` en el objeto que
    // se escribe (arroja "contains undefined in property...") — a
    // diferencia de `null`, que sí se persiste como "ausente". training/
    // lineupId son opcionales (Partido sin entreno; sin alineación
    // publicada todavía, el caso normal) así que hay que convertir
    // undefined -> null explícitamente antes de escribir, mismo criterio
    // que ya usa location aquí abajo.
    training: day.training ?? null,
    eventType: day.eventType ?? "TRAINING",
    location: day.location?.trim() ? day.location.trim() : null,
    accepted_players: existingDay?.accepted_players ?? [],
    declined_players: existingDay?.declined_players ?? [],
    lineupId: existingDay?.lineupId ?? null,
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

export type JoinByCodeResult = {
  found: boolean;
  /** "pending" | "pending_coach" | "joined" | "already_member" | undefined (dryRun) */
  status?: "pending" | "pending_coach" | "joined" | "already_member";
  teamname?: string;
  teamicon?: string | null;
};

/**
 * Busca un equipo por código y (si dryRun=false) solicita el ingreso, vía la
 * Cloud Function joinTeamByCode (Android functions/index.js, desplegada en
 * el mismo proyecto Firebase — cualquier cliente autenticado puede llamarla).
 * Necesaria porque las reglas RTDB no permiten a un no-miembro leer /Teams:
 * ni buscar por código ni añadirse a pendingplayers de forma segura
 * (transacción, sin pisar solicitudes concurrentes) son posibles con una
 * query+update de cliente puro — la vía anterior (`requestJoinTeam`, ya
 * eliminada) tenía justo esa carrera.
 */
export async function joinTeamByCode(
  teamcode: string,
  dryRun = false,
): Promise<JoinByCodeResult> {
  const result = await httpsCallable(
    functions,
    "joinTeamByCode",
  )({ teamcode, dryRun });
  return result.data as JoinByCodeResult;
}

/**
 * El propio usuario abandona su equipo, vía la Cloud Function leaveTeam: un
 * PLAYER no tiene permiso para escribir su propio Teams/{t}/userplayers. El
 * coach no puede abandonar (debe eliminar el equipo, ver deleteTeam).
 */
export async function leaveTeam(): Promise<void> {
  await httpsCallable(functions, "leaveTeam")();
}

/**
 * El coach elimina el equipo — escritura multi-path atómica (espejo de
 * TeamRepository.deleteTeam / ReadTeam.deleteTeamViaRepository): borra
 * Teams/{teamname} y desvincula a todos los jugadores, al coach fundador Y a
 * cualquier co-entrenador (su teamname también apunta al equipo) en la
 * misma operación.
 */
export async function deleteTeam(team: Team): Promise<void> {
  const teamname = team.teamname!;
  const resolvedUids = await Promise.all(
    team.userplayers.map((name) => resolveUidByName(name)),
  );
  const uids = Array.from(
    new Set(
      [...resolvedUids, team.usercoach, ...Object.keys(team.coaches)].filter(
        (uid): uid is string => Boolean(uid),
      ),
    ),
  );

  const updates: Record<string, unknown> = { [`${PATHS.TEAMS}/${teamname}`]: null };
  for (const uid of uids) {
    updates[`${PATHS.USERS}/${uid}/teamname`] = null;
    updates[`${PATHS.USERS}/${uid}/assistedTrainingDays`] = null;
  }
  await update(ref(db), updates);
}

/** Icono de equipo — sube a team_images/{teamname}/... (ver storage.rules). */
export async function updateTeamIcon(teamname: string, iconUrl: string): Promise<void> {
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), { teamicon: iconUrl });
}

/**
 * Categoría del equipo dentro de su club ("Seniors", "Sub-18"...) — al
 * crear un equipo+club solo se fijaba una vez (onboarding); esto permite
 * cambiarla después desde ClubManager (director del club o ADMIN viendo el
 * club). null = sin categoría (equipo aceptado en el club sin clasificar
 * todavía). Ningún cambio de reglas RTDB hace falta: ya es una escritura
 * normal a Teams/{teamname}, cubierta por el mismo .write que roster/icono.
 */
export async function updateTeamCategory(teamname: string, category: string | null): Promise<void> {
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), { category });
}

/**
 * Un ADMIN elimina un equipo ajeno (o el suyo) vía la Cloud Function
 * adminDeleteTeam: a diferencia de deleteTeam (update client-side), también
 * limpia su icono en Storage — un delete de Storage está bloqueado
 * estructuralmente desde el cliente por storage.rules (request.resource es
 * null en un delete), así que esa limpieza solo puede hacerla el Admin SDK.
 * El contenido privacy=="Club" del club de este equipo NO se ve afectado
 * (pertenece al club, no a este team en concreto).
 */
export async function adminDeleteTeam(teamname: string): Promise<void> {
  await httpsCallable(functions, "adminDeleteTeam")({ teamname });
}
