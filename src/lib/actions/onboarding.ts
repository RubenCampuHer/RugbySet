// Acciones del wizard de onboarding (rol + crear/unirse a equipo) para
// usuarios nuevos — mirror de Android: LoginViewModel.ensureGoogleUserProfile,
// SetupRoleFragment, SetupCreateTeamFragment y SetupCreateClubFragment.
// Ninguna regla de RTDB/Storage necesitó cambiar: la excepción de creación
// de Teams/Clubs ("nodo no existe + usercoach/role propios") ya cubría este
// flujo, solo nunca se había ejercitado desde la web.
import type { User as FirebaseUser } from "firebase/auth";
import { equalTo, get, orderByChild, push, query, ref, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { ClubSchema } from "@/lib/schemas/club";
import { parseOr } from "@/lib/schemas/common";
import {
  CLUB_CATEGORIES,
  randomCodeSuffix,
  suggestTeamCode,
  validateTeamCode,
  validateTeamName,
} from "@/lib/team-validation";
import type { Club, Role, Team } from "@/lib/types";

// Reexportados desde team-validation.ts (lógica pura, sin Firebase) para no
// romper a quien ya importaba estos símbolos desde este módulo.
export { CLUB_CATEGORIES, randomCodeSuffix, suggestTeamCode, validateTeamCode, validateTeamName };

/**
 * Espejo de LoginViewModel.ensureGoogleUserProfile / UserRepository.createUser:
 * un usuario que entra con Google por primera vez no tiene nodo Users/{uid}
 * (solo el registro por email lo crea en Android). Crea aquí un perfil base
 * con role PLAYER por defecto — el wizard lo sobreescribe si elige Entrenador.
 * No-op si el nodo ya existe (idempotente, igual que en Android).
 */
export async function ensureUserProfile(user: FirebaseUser): Promise<boolean> {
  const userRef = ref(db, `${PATHS.USERS}/${user.uid}`);
  const snap = await get(userRef);
  if (snap.exists()) return false;

  const displayName = (user.displayName ?? "").trim();
  const nameSurname = displayName || "Usuario";
  const email = user.email ?? "";
  const username = email.split("@")[0]?.trim() || user.uid.slice(0, 12);

  await update(userRef, {
    userId: user.uid,
    nameSurname,
    username,
    mail: email,
    role: "PLAYER",
    onboardingComplete: false,
    assistedTrainingDays: [],
    favExercises: [],
    favTrainings: [],
  });
  return true;
}

/** Mirror de SetupRoleFragment: fija solo Users/{uid}/role. */
export async function setUserRole(uid: string, role: Role): Promise<void> {
  await update(ref(db, `${PATHS.USERS}/${uid}`), { role });
}

/**
 * Fin del wizard (mirror de SetupActivity.finishSetup escribiendo el campo
 * de servidor, ver también Android SetupActivity.kt): marca la cuenta como
 * configurada para que CUALQUIER navegador/dispositivo deje de mostrar el
 * onboarding, no solo el que lo completó (ver onboarding-flag.ts, que sigue
 * existiendo como caché local para evitar parpadeo en la misma pestaña).
 */
export async function markOnboardingComplete(uid: string): Promise<void> {
  await update(ref(db, `${PATHS.USERS}/${uid}`), { onboardingComplete: true });
}

/** Mirror de ClubRepository.getClubByCode — comprobar unicidad antes de crear. */
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

function buildTeam(opts: {
  teamName: string;
  teamCode: string;
  iconUrl: string | null;
  coachName: string;
  uid: string;
  clubId?: string;
  category?: string;
  /** El fundador ya NO se añade como jugador por defecto (rediseño multi-coach 2026-09-03: coach y jugador son cosas distintas) — opt-in explícito. */
  alsoPlayer?: boolean;
}): Team {
  return {
    teamname: opts.teamName,
    usercoach: opts.uid,
    teamcode: opts.teamCode,
    teamicon: opts.iconUrl ?? "",
    // Rosters por uid (2026-09-04): {uid: true}, no el nombre del coach.
    userplayers: opts.alsoPlayer ? { [opts.uid]: true } : {},
    pendingplayers: {},
    trainingdays: [],
    clubId: opts.clubId ?? null,
    category: opts.category ?? null,
    lineups: {},
    coaches: {},
    pendingCoaches: {},
  };
}

/**
 * Mirror de SetupCreateTeamFragment.createStandaloneTeam: crea el equipo y
 * vincula al coach — atómico (patrón ya usado en lib/actions/team.ts, más
 * seguro que las dos escrituras secuenciales de Android).
 */
export async function createStandaloneTeam(opts: {
  teamName: string;
  teamCode: string;
  iconUrl: string | null;
  coachName: string;
  uid: string;
  alsoPlayer?: boolean;
}): Promise<void> {
  const error = validateTeamName(opts.teamName);
  if (error) throw new Error(error);

  const team = buildTeam(opts);
  await update(ref(db), {
    [`${PATHS.TEAMS}/${opts.teamName}`]: team,
    [`${PATHS.USERS}/${opts.uid}/teamname`]: opts.teamName,
    // Varios equipos (fase 1, 2026-09-04): la pertenencia va en el mismo
    // update — la regla de UserTeams evalúa `root` ya combinado, así que
    // tanto "soy usercoach del equipo" como "coincide con mi teamname" son
    // ciertos en esta misma escritura.
    [`${PATHS.USER_TEAMS}/${opts.uid}/${opts.teamName}`]: true,
  });
}

/**
 * Un entrenador que YA tiene equipo crea otro más (varios equipos, fase 2 —
 * 2026-09-04), desde la pestaña Equipo: suelto o dentro de un club que ya
 * dirige (nunca crea un club nuevo aquí — directorOfClubId es un puntero
 * único, "varios clubes por director" no está en alcance). El equipo activo
 * solo cambia si el usuario no tenía ninguno (decisión de producto: entrar
 * en otro equipo nunca te cambia la pantalla; el cliente ofrece "Cambiar").
 *
 * Con club: Teams/{t}/clubId pasa la .validate porque quien escribe dirige
 * ese club Y es usercoach del equipo en la misma escritura (root ya
 * combinado); Clubs/{id}/teams se actualiza aparte, como addTeamToClub.
 */
export async function createAdditionalTeam(opts: {
  teamName: string;
  teamCode: string;
  iconUrl: string | null;
  coachName: string;
  uid: string;
  alsoPlayer?: boolean;
  club?: Club | null;
  category?: string;
  setActive: boolean;
}): Promise<void> {
  const error = validateTeamName(opts.teamName);
  if (error) throw new Error(error);

  const team = buildTeam({
    teamName: opts.teamName,
    teamCode: opts.teamCode,
    iconUrl: opts.iconUrl,
    coachName: opts.coachName,
    uid: opts.uid,
    clubId: opts.club?.clubId ?? undefined,
    category: opts.club ? opts.category : undefined,
    alsoPlayer: opts.alsoPlayer,
  });
  const updates: Record<string, unknown> = {
    [`${PATHS.TEAMS}/${opts.teamName}`]: team,
    [`${PATHS.USER_TEAMS}/${opts.uid}/${opts.teamName}`]: true,
  };
  if (opts.setActive) updates[`${PATHS.USERS}/${opts.uid}/teamname`] = opts.teamName;
  await update(ref(db), updates);

  if (opts.club?.clubId) {
    const teams = opts.club.teams.includes(opts.teamName)
      ? opts.club.teams
      : [...opts.club.teams, opts.teamName];
    await update(ref(db, `${PATHS.CLUBS}/${opts.club.clubId}`), { teams });
  }
}

/**
 * Mirror de SetupCreateTeamFragment.createClubAndTeam +
 * SetupCreateClubFragment: crea el club (push id) y su primer equipo,
 * vincula al coach.
 *
 * NO es una única escritura atómica (a diferencia de lo que decía este
 * comentario antes de 2026-08-21): Teams/{teamName}/clubId tiene una
 * .validate que comprueba Clubs/{clubId}/adminUserId — si Clubs/{clubId}
 * se crea EN LA MISMA escritura que el equipo, esa referencia cruzada
 * entre dos nodos top-level distintos no se resuelve de forma fiable
 * contra el árbol ya combinado (permission denied real contra RTDB,
 * confirmado en QA; cada escritura por separado sí vale). Por eso el club
 * se crea primero (ya comprometido) y solo después el equipo + el
 * teamname del coach.
 */
export async function createClubAndTeam(opts: {
  clubName: string;
  clubCode: string;
  clubIconUrl: string | null;
  category: string;
  teamName: string;
  teamCode: string;
  teamIconUrl: string | null;
  coachName: string;
  uid: string;
  alsoPlayer?: boolean;
}): Promise<void> {
  const error = validateTeamName(opts.teamName);
  if (error) throw new Error(error);

  const clubId = push(ref(db, PATHS.CLUBS)).key;
  if (!clubId) throw new Error("No se pudo generar el club");

  const club: Club = {
    clubId,
    clubname: opts.clubName,
    clubcode: opts.clubCode,
    clubicon: opts.clubIconUrl,
    adminUserId: opts.uid,
    teams: [opts.teamName],
    pendingTeams: {},
    directors: {},
  };
  const team = buildTeam({
    teamName: opts.teamName,
    teamCode: opts.teamCode,
    iconUrl: opts.teamIconUrl,
    coachName: opts.coachName,
    uid: opts.uid,
    clubId,
    category: opts.category,
    alsoPlayer: opts.alsoPlayer,
  });

  await update(ref(db, `${PATHS.CLUBS}/${clubId}`), club);
  await update(ref(db), {
    [`${PATHS.TEAMS}/${opts.teamName}`]: team,
    [`${PATHS.USERS}/${opts.uid}/teamname`]: opts.teamName,
    [`${PATHS.USER_TEAMS}/${opts.uid}/${opts.teamName}`]: true, // ver createStandaloneTeam
  });
  // Puntero de descubrimiento del club que dirijo (rediseño multi-director
  // 2026-09-03) — mismo criterio que createClub en actions/club.ts.
  await update(ref(db, `${PATHS.USERS}/${opts.uid}`), { directorOfClubId: clubId });
}
