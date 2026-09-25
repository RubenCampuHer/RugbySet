// Acciones de gestión de equipo y calendario.
// ⚠️ Patrones de escritura CORRECTOS bajo database.rules.json — NO replicar
// la vía legacy Android (setValue del nodo Teams/Users completo), que está
// denegada en varios casos. Referencia: TeamRepository.kt (multi-path).
import { get, ref, set, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { eventDataKey, type AttendanceMark } from "@/lib/attendance";
import { PATHS } from "@/lib/constants";
import { db, functions } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { UserTeamsSchema } from "@/lib/schemas/user";
import { nextActiveTeam } from "@/lib/teams";
import {
  findRawDay,
  patchRawDay,
  rawDays,
  removeRawDay,
  upsertRawDay,
  type RawDay,
} from "@/lib/trainingdays";
import type { Team, Training } from "@/lib/types";

/**
 * Autorreparación entre el equipo ACTIVO (Users/{uid}/teamname) y las
 * pertenencias (UserTeams/{uid}) — varios equipos, fases 1-2 (2026-09-04).
 * Se llama desde AuthProvider cada vez que cambia el perfil propio:
 *
 * - Con activo: garantiza que figure en UserTeams. Cubre altas hechas desde
 *   Android (que solo escribe teamname) y cuentas anteriores al backfill.
 *   La regla permite al propio usuario esta escritura únicamente cuando
 *   $teamname coincide con su teamname — no sirve para auto-añadirse a
 *   otro equipo.
 * - Sin activo pero con pertenencias (p. ej. el coach me expulsó del equipo
 *   que tenía activo, o lo borró): pasa a activo el siguiente por orden
 *   alfabético (nextActiveTeam). Quien expulsa no puede leer mis UserTeams
 *   (regla: solo dueño/ADMIN), así que esta recolocación tiene que hacerla
 *   el propio usuario al volver a cargar el perfil.
 *
 * Idempotente y barata: un get y, como mucho, una escritura.
 */
export async function reconcileActiveTeam(uid: string, teamname: string | null): Promise<void> {
  if (teamname) {
    const membershipRef = ref(db, `${PATHS.USER_TEAMS}/${uid}/${teamname}`);
    const snap = await get(membershipRef);
    if (snap.val() === true) return;
    await set(membershipRef, true);
    return;
  }
  const snap = await get(ref(db, `${PATHS.USER_TEAMS}/${uid}`));
  if (!snap.exists()) return;
  const memberships = parseOr(UserTeamsSchema, snap.val(), `UserTeams/${uid}`) ?? {};
  const next = nextActiveTeam(Object.keys(memberships));
  if (next) await setActiveTeam(uid, next);
}

/**
 * Cambia el equipo ACTIVO (el que ven todas las pantallas vía useTeam()).
 * Solo escribe Users/{uid}/teamname; el cliente solo ofrece equipos de
 * UserTeams (TeamSwitcher). Android lee este mismo campo → también le
 * cambia el equipo que muestra.
 */
export async function setActiveTeam(uid: string, teamname: string): Promise<void> {
  await update(ref(db, `${PATHS.USERS}/${uid}`), { teamname });
}

/**
 * ¿Es `teamname` el equipo ACTIVO de ese usuario? Vía publicProfiles (el
 * coach no puede leer Users/{otro}); es una proyección asíncrona
 * (mirrorPublicProfile), así que puede ir un instante por detrás — se usa
 * solo para decidir si tocar o no el puntero activo de otro usuario.
 */
async function isActiveTeamOf(uid: string, teamname: string): Promise<boolean> {
  const snap = await get(ref(db, `${PATHS.PUBLIC_PROFILES}/${uid}/teamname`));
  const active = snap.val();
  // Sin proyección todavía (usuario nuevo, mirror en camino): asumir que SÍ
  // era su activo y limpiarlo — comportamiento anterior a la fase 2. Lo
  // contrario dejaría un teamname colgando hacia un equipo del que ya no es
  // miembro, con el que seguiría pudiendo leerlo (regla Users.teamname).
  if (typeof active !== "string" || active.length === 0) return true;
  return active === teamname;
}

/** ¿Tiene ese usuario algún equipo activo? (misma fuente que isActiveTeamOf). */
async function hasActiveTeam(uid: string): Promise<boolean> {
  const snap = await get(ref(db, `${PATHS.PUBLIC_PROFILES}/${uid}/teamname`));
  return typeof snap.val() === "string" && snap.val().length > 0;
}

/**
 * Coach acepta a un pendiente — multi-path atómico (espejo de
 * TeamRepository.acceptPendingPlayer): sale de pendingplayers, entra en
 * userplayers (ambos mapas {uid: true}, rosters por uid 2026-09-04 — ver
 * schemas/team.ts) y su Users/{uid}/teamname apunta al equipo si no tenía
 * ninguno activo (fase 2). El uid ya lo tiene la UI (roster resuelto vía
 * useProfilesByUid) — no hace falta resolver ningún nombre.
 */
export async function acceptPendingPlayer(team: Team, uid: string) {
  const teamname = team.teamname!;
  const updates: Record<string, unknown> = {
    [`${PATHS.TEAMS}/${teamname}/pendingplayers/${uid}`]: null,
    [`${PATHS.TEAMS}/${teamname}/userplayers/${uid}`]: true,
    [`${PATHS.USER_TEAMS}/${uid}/${teamname}`]: true,
  };
  if (!(await hasActiveTeam(uid))) updates[`${PATHS.USERS}/${uid}/teamname`] = teamname;
  await update(ref(db), updates);
}

/** Coach rechaza a un pendiente — escribe solo pendingplayers. */
export async function rejectPendingPlayer(team: Team, uid: string) {
  await update(ref(db), {
    [`${PATHS.TEAMS}/${team.teamname}/pendingplayers/${uid}`]: null,
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
  const updates: Record<string, unknown> = {
    [`${PATHS.TEAMS}/${teamname}/pendingCoaches/${uid}`]: null,
    [`${PATHS.TEAMS}/${teamname}/coaches/${uid}`]: true,
    [`${PATHS.USER_TEAMS}/${uid}/${teamname}`]: true,
  };
  // Fase 2: solo pasa a activo si no tenía ninguno (ver acceptPendingPlayer).
  if (!(await hasActiveTeam(uid))) updates[`${PATHS.USERS}/${uid}/teamname`] = teamname;
  await update(ref(db), updates);
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
  const updates: Record<string, unknown> = {
    [`${PATHS.TEAMS}/${teamname}/coaches/${uid}`]: null,
    [`${PATHS.USER_TEAMS}/${uid}/${teamname}`]: null,
  };
  // Fase 2: solo se toca su activo si ERA este equipo — si le quedan otros,
  // su propio AuthProvider recoloca el activo (reconcileActiveTeam).
  if (await isActiveTeamOf(uid, teamname)) {
    updates[`${PATHS.USERS}/${uid}/teamname`] = null;
    updates[`${PATHS.USERS}/${uid}/assistedTrainingDays`] = null;
  }
  await update(ref(db), updates);
}

/**
 * Reasigna quién es el entrenador principal (fundador) del equipo a un
 * co-entrenador YA existente — pedido explícito 2026-09-04: un fundador
 * quiere poder abandonar el equipo "siempre que deje a alguien al mando".
 * No hace falta ninguna acción de "abandonar" nueva: en cuanto el fundador
 * actual pasa a ser un co-entrenador más (este intercambio), la vía de
 * salida que YA tiene cualquier co-entrenador (leaveTeam, Cloud Function)
 * empieza a funcionar para él sin tocar nada más — antes esa función
 * bloqueaba explícitamente a quien fuera team.usercoach.
 */
export async function transferTeamOwnership(team: Team, newFounderUid: string): Promise<void> {
  const teamname = team.teamname!;
  const currentFounderUid = team.usercoach;
  if (!currentFounderUid) throw new Error("Este equipo no tiene entrenador fundador");
  if (team.coaches[newFounderUid] !== true) {
    throw new Error("Solo puedes transferir a alguien que ya sea co-entrenador");
  }
  await update(ref(db), {
    [`${PATHS.TEAMS}/${teamname}/usercoach`]: newFounderUid,
    [`${PATHS.TEAMS}/${teamname}/coaches/${newFounderUid}`]: null,
    [`${PATHS.TEAMS}/${teamname}/coaches/${currentFounderUid}`]: true,
  });
}

/**
 * Un jugador YA en el roster se sube a co-entrenador de un tirón — sin pasar
 * por pendingCoaches (el coach que lo asciende ya lo conoce, no hace falta
 * que "se solicite" a sí mismo). Sale de userplayers, entra en coaches.
 */
export async function promoteToCoach(team: Team, uid: string) {
  const teamname = team.teamname!;
  await update(ref(db), {
    [`${PATHS.TEAMS}/${teamname}/userplayers/${uid}`]: null,
    [`${PATHS.TEAMS}/${teamname}/coaches/${uid}`]: true,
  });
}

/**
 * Inverso de promoteToCoach (2026-09-04): un co-entrenador (nunca el
 * fundador — para eso está transferTeamOwnership) baja a jugador del mismo
 * equipo. Sigue en el equipo (UserTeams y equipo activo intactos); solo
 * cambia de coaches a userplayers. El rol global (Users.role) no se toca,
 * misma decisión que promoteToCoach/acceptPendingCoach.
 */
export async function demoteCoachToPlayer(team: Team, uid: string) {
  const teamname = team.teamname!;
  if (team.usercoach === uid) throw new Error("El entrenador principal no se puede descender; transfiere primero.");
  await update(ref(db), {
    [`${PATHS.TEAMS}/${teamname}/coaches/${uid}`]: null,
    [`${PATHS.TEAMS}/${teamname}/userplayers/${uid}`]: true,
  });
}

/**
 * Coach expulsa a un jugador — multi-path atómico (espejo de
 * TeamRepository.removePlayer): fuera de userplayers y se limpian su
 * teamname y asistencia (escrituras por hijo, permitidas al coach).
 */
export async function removePlayer(team: Team, uid: string) {
  const teamname = team.teamname!;
  const updates: Record<string, unknown> = {
    [`${PATHS.TEAMS}/${teamname}/userplayers/${uid}`]: null,
    [`${PATHS.USER_TEAMS}/${uid}/${teamname}`]: null,
  };
  // Fase 2: su activo solo se limpia si era ESTE equipo (ver removeCoach).
  if (await isActiveTeamOf(uid, teamname)) {
    updates[`${PATHS.USERS}/${uid}/teamname`] = null;
    updates[`${PATHS.USERS}/${uid}/assistedTrainingDays`] = null;
  }
  await update(ref(db), updates);
}

/** Formato de fecha compartido con Android: "dd/MM/yyyy". */
export type AttendanceStatus = "accepted" | "declined";

function toDateList(v: unknown): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.filter(Boolean) : (Object.values(v as object).filter(Boolean) as string[]);
}

/**
 * Pasar lista con asistencia real (paso 2 Kanteo, 2026-09-25): escribe
 * Teams/{t}/eventData/{yyyy-MM-dd}/attendance/{uid} sin tocar la respuesta del
 * jugador (accepted/declined_players). null borra la marca (vuelve a contar su
 * respuesta). Después, como setAttendanceBulk, la lista personal
 * assistedTrainingDays que Android sigue leyendo: presente/tarde añaden la
 * fecha y el resto la quita (Android no sabe excluir días justificados). Esa
 * parte puede fallar por reglas si el equipo activo del jugador es otro: se
 * cuenta en vez de abortar, porque la marca ya está guardada.
 */
export async function setAttendanceMarks(opts: {
  teamname: string;
  fecha: string;
  marks: Record<string, AttendanceMark | null>;
}): Promise<{ marked: number; personalFailed: number }> {
  const { teamname, fecha, marks } = opts;
  const key = eventDataKey(fecha);
  if (!key) throw new Error("Fecha no válida");
  const uids = Object.keys(marks);
  if (uids.length === 0) return { marked: 0, personalFailed: 0 };
  await update(ref(db, `${PATHS.TEAMS}/${teamname}/eventData/${key}/attendance`), marks);

  const results = await Promise.allSettled(
    uids
      .filter((uid) => marks[uid] !== null)
      .map(async (uid) => {
        const snap = await get(ref(db, `${PATHS.USERS}/${uid}/assistedTrainingDays`));
        const days = toDateList(snap.val()).filter((d) => d !== fecha);
        if (marks[uid] === "present" || marks[uid] === "late") days.push(fecha);
        await update(ref(db, `${PATHS.USERS}/${uid}`), { assistedTrainingDays: days });
      }),
  );
  return { marked: uids.length, personalFailed: results.filter((r) => r.status === "rejected").length };
}

/**
 * Ficha del jugador en el equipo (Teams/{t}/playerInfo/{uid}, 2026-09-25): la
 * escribe el cuerpo técnico con el .write del equipo. Ficha vacía = se borra.
 */
export async function setPlayerInfo(
  teamname: string,
  uid: string,
  info: { positions: number[]; number: number | null; captain: boolean; injured: boolean },
): Promise<void> {
  const clean = {
    positions: info.positions.length > 0 ? info.positions.slice(0, 5) : null,
    number: info.number ?? null,
    captain: info.captain || null,
    injured: info.injured || null,
  };
  const empty = Object.values(clean).every((v) => v === null);
  await set(ref(db, `${PATHS.TEAMS}/${teamname}/playerInfo/${uid}`), empty ? null : clean);
}

/**
 * Motivo del propio jugador al decir que no (eventData/{día}/rsvpNotes/{uid},
 * regla: solo él y solo si es jugador del equipo). null lo borra — p. ej. al
 * cambiar a "sí". Solo web: Android no lo muestra.
 */
export async function setDeclineReason(opts: {
  teamname: string;
  fecha: string;
  uid: string;
  reason: string | null;
}): Promise<void> {
  const key = eventDataKey(opts.fecha);
  if (!key) throw new Error("Fecha no válida");
  const reason = opts.reason?.trim().slice(0, 200) || null;
  await set(
    ref(db, `${PATHS.TEAMS}/${opts.teamname}/eventData/${key}/rsvpNotes/${opts.uid}`),
    reason ? { reason, at: Date.now() } : null,
  );
}

/**
 * Confirmar/rechazar asistencia de un jugador en un día concreto. Escribe
 * SOLO la entrada propia de accepted/declined_players (rosters por uid,
 * 2026-09-04 — la regla ahora exige que sea TU entrada, o que quien escribe
 * sea el coach del equipo/ADMIN) + el assistedTrainingDays del jugador
 * (dueño, o coach del equipo). Válido para el propio jugador y para el
 * coach pasando lista.
 */
export async function setAttendance(opts: {
  teamname: string;
  fecha: string;
  playerUid: string;
  status: AttendanceStatus;
}) {
  const { teamname, fecha, playerUid, status } = opts;

  // Índice REAL del día en el array (puede ser disperso) — leer crudo.
  const daysSnap = await get(ref(db, `${PATHS.TEAMS}/${teamname}/trainingdays`));
  let idx: string | null = null;
  daysSnap.forEach((child) => {
    if (child.child("fecha").val() === fecha) {
      idx = child.key;
      return true;
    }
    return false;
  });
  if (idx === null) throw new Error("Día de entreno no encontrado");

  await update(ref(db, `${PATHS.TEAMS}/${teamname}/trainingdays/${idx}`), {
    [`accepted_players/${playerUid}`]: status === "accepted" ? true : null,
    [`declined_players/${playerUid}`]: status === "declined" ? true : null,
  });

  // Asistencia personal (dd/MM/yyyy) — Android sigue leyéndola, ver fase 3.
  const favSnap = await get(
    ref(db, `${PATHS.USERS}/${playerUid}/assistedTrainingDays`),
  );
  const days = toDateList(favSnap.val()).filter((d) => d !== fecha);
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
) {
  // Solo los campos del editor (espejo de TeamWrites.dayEditorFields): el
  // resto del día (asistencia, lineupId, cancelled y cualquier clave que
  // esta versión no conozca) se conserva al fusionar sobre el dato CRUDO.
  // null borra la clave (Firebase rechaza undefined; mergeNode lo descarta).
  await mutateTrainingDays(teamname, (days) =>
    upsertRawDay(days, day.fecha, {
      horaInicio: day.horaInicio,
      horaFin: day.horaFin,
      nameTrainingDay: day.nameTrainingDay ?? "",
      training: day.training ?? null,
      eventType: day.eventType ?? "TRAINING",
      location: day.location?.trim() ? day.location.trim() : null,
    }),
  );
}

/**
 * Lee Teams/{t}/trainingdays CRUDO, aplica `fn` y reescribe el array. Nunca
 * se escribe a partir de `team.trainingdays` parseado: Zod quita las claves
 * que no conoce y se perderían en TODOS los días. Devuelve la lista anterior.
 */
export async function mutateTrainingDays(
  teamname: string,
  fn: (days: RawDay[]) => RawDay[],
): Promise<RawDay[]> {
  const snap = await get(ref(db, `${PATHS.TEAMS}/${teamname}/${PATHS.TRAINING_DAYS}`));
  const before = rawDays(snap.val());
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), {
    [PATHS.TRAINING_DAYS]: fn(before),
  });
  return before;
}

/**
 * Cancela (o reactiva) un evento sin borrarlo: sigue en el calendario,
 * marcado, con sus respuestas. Campo solo web — Android lo conserva al
 * editar (fusiona) pero todavía no lo pinta.
 */
export async function setEventCancelled(teamname: string, fecha: string, cancelled: boolean) {
  await mutateTrainingDays(teamname, (days) =>
    patchRawDay(days, fecha, { cancelled: cancelled ? true : null }),
  );
}

/**
 * Coach borra un día — reescribe trainingdays sin él y limpia la fecha del
 * assistedTrainingDays de cada jugador que había confirmado (escritura por
 * hijo — la vía legacy Android con setValue del User completo estaba
 * denegada y dejaba asistencias huérfanas).
 */
export async function deleteTrainingDay(teamname: string, fecha: string) {
  const before = await mutateTrainingDays(teamname, (days) => removeRawDay(days, fecha));
  const removed = findRawDay(before, fecha);
  const accepted = removed?.accepted_players;
  // Rosters por uid: accepted_players ya son claves de uid directamente.
  for (const uid of Object.keys(accepted && typeof accepted === "object" ? accepted : {})) {
    const snap = await get(ref(db, `${PATHS.USERS}/${uid}/assistedTrainingDays`));
    const days = toDateList(snap.val()).filter((d) => d !== fecha);
    await update(ref(db, `${PATHS.USERS}/${uid}`), { assistedTrainingDays: days });
  }
}

export type JoinByCodeResult = {
  found: boolean;
  /** "pending" | "pending_coach" | "joined" | "already_member" | undefined (dryRun) */
  status?: "pending" | "pending_coach" | "joined" | "already_member";
  teamname?: string;
  teamicon?: string | null;
  /** Solo con status "joined" (fase 2): true si pasó a ser el equipo activo (no tenía ninguno). */
  activeChanged?: boolean;
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
export type JoinAs = "player" | "coach";

export async function joinTeamByCode(
  teamcode: string,
  dryRun = false,
  /** Coach en un equipo y jugador en otro (2026-09-04): como qué se entra. Sin valor, decide el rol global (comportamiento histórico). */
  as?: JoinAs,
): Promise<JoinByCodeResult> {
  const result = await httpsCallable(
    functions,
    "joinTeamByCode",
  )(as ? { teamcode, dryRun, as } : { teamcode, dryRun });
  return result.data as JoinByCodeResult;
}

/**
 * El propio usuario abandona UN equipo, vía la Cloud Function leaveTeam: un
 * PLAYER no tiene permiso para escribir su propio Teams/{t}/userplayers. El
 * fundador no puede abandonar (debe eliminar el equipo, ver deleteTeam).
 * Fase 2: se indica de cuál se sale; si era el activo, la función recoloca
 * el activo al siguiente de UserTeams (o null) y lo devuelve.
 */
export async function leaveTeam(teamname: string): Promise<{ activeTeam: string | null }> {
  const result = await httpsCallable(functions, "leaveTeam")({ teamname });
  const data = result.data as { activeTeam?: string | null } | undefined;
  return { activeTeam: data?.activeTeam ?? null };
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
  // Rosters por uid: userplayers ya son claves de uid, sin resolver nombres.
  const uids = Array.from(
    new Set(
      [...Object.keys(team.userplayers), team.usercoach, ...Object.keys(team.coaches)].filter(
        (uid): uid is string => Boolean(uid),
      ),
    ),
  );

  const updates: Record<string, unknown> = { [`${PATHS.TEAMS}/${teamname}`]: null };
  const activeFlags = await Promise.all(uids.map((uid) => isActiveTeamOf(uid, teamname)));
  uids.forEach((uid, i) => {
    updates[`${PATHS.USER_TEAMS}/${uid}/${teamname}`] = null;
    // Fase 2: el activo solo se limpia a quien tenía ESTE equipo activo.
    if (activeFlags[i]) {
      updates[`${PATHS.USERS}/${uid}/teamname`] = null;
      updates[`${PATHS.USERS}/${uid}/assistedTrainingDays`] = null;
    }
  });
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
 * Cambia el código de acceso del equipo — campo normal de
 * Teams/{teamname}, cubierto por el mismo .write que roster/icono/
 * categoría (ningún cambio de reglas). Antes de escribir comprueba que el
 * código nuevo no colisione con el de OTRO equipo, con el mismo dryRun de
 * joinTeamByCode que ya usan onboarding/CreateTeamDialog al crear un
 * equipo — las reglas no dejan a nadie leer /Teams por su cuenta para
 * comprobarlo de otra forma.
 */
export async function updateTeamCode(teamname: string, newCode: string): Promise<void> {
  const dup = await joinTeamByCode(newCode, true);
  if (dup.found) throw new Error("Ese código ya lo usa otro equipo.");
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), { teamcode: newCode });
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

/**
 * Renombra el equipo — vía la Cloud Function renameTeam: Teams/{teamname}
 * usa el nombre como clave RTDB, mover una clave no es expresable como un
 * update() de cliente (hay que leer el árbol viejo para escribirlo bajo la
 * clave nueva) — mismo motivo por el que adminDeleteTeam es función.
 * Corrige UserTeams/Users.teamname/Clubs.teams de cada miembro en el mismo
 * paso; devuelve el nombre final para que el caller navegue a la URL
 * correcta (?team=... si venía con uno).
 */
export async function renameTeam(teamname: string, newTeamname: string): Promise<{ teamname: string }> {
  const result = await httpsCallable(functions, "renameTeam")({ teamname, newTeamname });
  return result.data as { teamname: string };
}
