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
import { CLUB_CATEGORIES, validateTeamName } from "@/lib/team-validation";
import type { Club, Role, Team } from "@/lib/types";

// Reexportados desde team-validation.ts (lógica pura, sin Firebase) para no
// romper a quien ya importaba estos dos símbolos desde este módulo.
export { CLUB_CATEGORIES, validateTeamName };

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
}): Team {
  return {
    teamname: opts.teamName,
    usercoach: opts.uid,
    teamcode: opts.teamCode,
    teamicon: opts.iconUrl ?? "",
    userplayers: [opts.coachName],
    pendingplayers: [],
    trainingdays: [],
    clubId: opts.clubId ?? null,
    category: opts.category ?? null,
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
}): Promise<void> {
  const error = validateTeamName(opts.teamName);
  if (error) throw new Error(error);

  const team = buildTeam(opts);
  await update(ref(db), {
    [`${PATHS.TEAMS}/${opts.teamName}`]: team,
    [`${PATHS.USERS}/${opts.uid}/teamname`]: opts.teamName,
  });
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
  };
  const team = buildTeam({
    teamName: opts.teamName,
    teamCode: opts.teamCode,
    iconUrl: opts.teamIconUrl,
    coachName: opts.coachName,
    uid: opts.uid,
    clubId,
    category: opts.category,
  });

  await update(ref(db, `${PATHS.CLUBS}/${clubId}`), club);
  await update(ref(db), {
    [`${PATHS.TEAMS}/${opts.teamName}`]: team,
    [`${PATHS.USERS}/${opts.uid}/teamname`]: opts.teamName,
  });
}
