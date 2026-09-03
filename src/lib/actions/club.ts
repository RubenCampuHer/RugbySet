// Acciones de gestión de club — mismo patrón de escrituras multi-path
// atómicas que lib/actions/team.ts. Las reglas RTDB (database.rules.json,
// repo Android) dan al admin del club el mismo control total sobre
// Teams/{teamname} que ya tenía un ADMIN global, acotado a los equipos de
// SU club (Clubs/{clubId}.adminUserId).
import { equalTo, get, orderByChild, push, query, ref, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { ClubSchema } from "@/lib/schemas/club";
import type { Club } from "@/lib/types";

type ContentKind = "exercise" | "training";

/** Mirror de ClubRepository.getClubByCode — búsqueda pública por código. */
export async function getClubByCode(clubcode: string): Promise<Club | null> {
  const snap = await get(
    query(ref(db, PATHS.CLUBS), orderByChild("clubcode"), equalTo(clubcode)),
  );
  let club: Club | null = null;
  snap.forEach((child) => {
    club = parseOr(ClubSchema, child.val(), `Clubs/${child.key}`);
    return true;
  });
  return club;
}

/**
 * Un coach sin club (o que quiere crear uno nuevo) funda un club con su
 * propio equipo como miembro fundador — queda como adminUserId.
 *
 * NO es un único update() multi-path: la .validate de Teams/{team}/clubId
 * comprueba root.child('Clubs').child(clubId).child('adminUserId') — si
 * Clubs/{clubId} se crea EN LA MISMA escritura, esa referencia cruzada
 * entre dos nodos top-level distintos no se resuelve de forma fiable
 * contra el árbol ya combinado (comprobado en QA 2026-08-21: permission
 * denied real contra RTDB, aunque cada escritura por separado sí vale).
 * Por eso el club se crea PRIMERO (paso 1, ya comprometido) y solo
 * DESPUÉS (paso 2) se vincula el equipo — para entonces la referencia ya
 * es un hecho estable, no simultáneo.
 */
export async function createClub(opts: {
  clubName: string;
  clubCode: string;
  clubIconUrl: string | null;
  category?: string | null;
  teamname: string;
  uid: string;
}): Promise<string> {
  const clubId = push(ref(db, PATHS.CLUBS)).key;
  if (!clubId) throw new Error("No se pudo generar el club");

  const club: Club = {
    clubId,
    clubname: opts.clubName,
    clubcode: opts.clubCode,
    clubicon: opts.clubIconUrl,
    adminUserId: opts.uid,
    teams: [opts.teamname],
    pendingTeams: {},
    directors: {},
  };

  await update(ref(db, `${PATHS.CLUBS}/${clubId}`), club);

  const teamUpdates: Record<string, unknown> = { clubId };
  if (opts.category) teamUpdates.category = opts.category;
  await update(ref(db, `${PATHS.TEAMS}/${opts.teamname}`), teamUpdates);
  // Puntero de descubrimiento (rediseño multi-director 2026-09-03) — mismo
  // criterio que team.usercoach: el fundador lo tiene desde el minuto uno,
  // igual que un co-director al ser nombrado (ver appointDirector).
  await update(ref(db, `${PATHS.USERS}/${opts.uid}`), { directorOfClubId: clubId });

  return clubId;
}

/**
 * Un director (fundador o co-director) nombra directamente a un
 * entrenador de uno de los equipos de SU club como co-director — sin paso
 * pendiente (el director ya lo conoce, mismo criterio que promoteToCoach
 * en equipos, no el de una solicitud con aceptación).
 */
export async function appointDirector(club: Club, uid: string): Promise<void> {
  const clubId = club.clubId!;
  await update(ref(db), {
    [`${PATHS.CLUBS}/${clubId}/directors/${uid}`]: true,
    [`${PATHS.USERS}/${uid}/directorOfClubId`]: clubId,
  });
}

/**
 * Quita a un co-director — lo hace el fundador (sobre cualquier
 * co-director) o el propio director sobre sí mismo (autoexclusión, sin
 * pedir permiso a nadie). Nunca al fundador (para eso no hay borrado de
 * club todavía — fuera de alcance).
 */
export async function removeDirector(club: Club, uid: string): Promise<void> {
  const clubId = club.clubId!;
  await update(ref(db), {
    [`${PATHS.CLUBS}/${clubId}/directors/${uid}`]: null,
    [`${PATHS.USERS}/${uid}/directorOfClubId`]: null,
  });
}

/**
 * El coach de un equipo sin club solicita unirse a uno existente — solo
 * escribe Clubs/{clubId}/pendingTeams/{teamname} = true (permitido a
 * cualquier autenticado por las reglas, igual que Team.pendingplayers); el
 * admin del club decide de verdad con approveTeamJoin/rejectTeamJoin. Ya NO
 * hay auto-unión. MAPA, no array — ver comentario en schemas/club.ts.
 */
export async function requestJoinClub(club: Club, teamname: string): Promise<void> {
  const clubId = club.clubId!;
  if (club.teams.includes(teamname)) return; // ya es miembro
  await update(ref(db, `${PATHS.CLUBS}/${clubId}/pendingTeams`), { [teamname]: true });
}

/**
 * El admin del club acepta la solicitud de un equipo. NO es un único
 * update() multi-path: database.rules.json valida el SET de
 * Teams/{teamname}/clubId comprobando que ESE teamname siga en
 * pendingTeams EN ESE MOMENTO — si la misma escritura ya lo borrara, las
 * reglas verían el árbol resultante (ya sin la entrada) y rechazarían la
 * comprobación. Por eso primero se fija clubId (con pendingTeams todavía
 * intacto) y solo DESPUÉS se limpia pendingTeams y se añade a teams.
 */
export async function approveTeamJoin(club: Club, teamname: string): Promise<void> {
  const clubId = club.clubId!;
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), { clubId });
  await update(ref(db, `${PATHS.CLUBS}/${clubId}`), {
    [`pendingTeams/${teamname}`]: null,
    teams: club.teams.includes(teamname) ? club.teams : [...club.teams, teamname],
  });
}

/** El admin del club rechaza la solicitud — solo limpia pendingTeams. */
export async function rejectTeamJoin(club: Club, teamname: string): Promise<void> {
  await update(ref(db, `${PATHS.CLUBS}/${club.clubId}/pendingTeams`), { [teamname]: null });
}

/**
 * El admin del club expulsa a un equipo de su club (sin borrarlo, solo lo
 * desvincula) — quita de teams y limpia Teams/{teamname}/clubId.
 *
 * NO es un único update() multi-path: si el equipo ya se había auto-salido
 * (leaveClub, clubId ya null), la regla de "clubId" deniega ese clear
 * concreto porque data.exists() es false — y un multi-path update() de
 * Firebase es todo-o-nada, así que fallaría también la limpieza de
 * Clubs/{clubId}/teams. Separarlo en dos pasos permite que la limpieza de
 * la lista siempre funcione aunque el desvínculo ya no haga falta.
 */
export async function removeTeamFromClub(club: Club, teamname: string): Promise<void> {
  const clubId = club.clubId!;
  try {
    await update(ref(db, `${PATHS.TEAMS}/${teamname}`), { clubId: null });
  } catch {
    // Ya no pertenecía a este club (referencia colgante) — se limpia igual abajo.
  }
  await update(ref(db, `${PATHS.CLUBS}/${clubId}`), {
    teams: club.teams.filter((n) => n !== teamname),
  });
}

/**
 * El propio coach de un equipo sale de su club actual (self-service, sin
 * pedir permiso al admin del club) — la regla de "clubId" en
 * database.rules.json permite este CLEAR concreto al coach del equipo.
 * No quita al equipo de Clubs/{clubId}/teams por sí solo (eso lo hace el
 * admin del club con removeTeamFromClub, o queda como referencia que el
 * admin verá y podrá limpiar) — evita que un coach necesite permiso sobre
 * el nodo Clubs ajeno solo para salir.
 */
export async function leaveClub(teamname: string): Promise<void> {
  await update(ref(db, `${PATHS.TEAMS}/${teamname}`), { clubId: null });
}

/**
 * El admin del club aprueba/rechaza un ejercicio o entreno privacy=="Club"
 * pendiente — wrapper fino sobre approvalStatus, mismo patrón que
 * updateApprovalStatus (admin.ts) pero autorizado por database.rules.json
 * a Clubs/{clubId}.adminUserId, no solo a un ADMIN global.
 */
export async function updateClubContentStatus(
  kind: ContentKind,
  name: string,
  status: "APPROVED" | "REJECTED",
): Promise<void> {
  const node = kind === "exercise" ? PATHS.EXERCISES : PATHS.TRAININGS;
  await update(ref(db, `${node}/${name}`), { approvalStatus: status });
}
