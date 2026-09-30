// Port literal de PermissionsManager.kt (repo Android) — mantener en
// sincronía caso por caso. Es la única lógica de negocio real del MVP:
// decide qué contenido ve cada usuario según privacy × approvalStatus.
import { type Audience, type AudienceViewer, canSeeAudience } from "./audience";
import type { Club, Exercise, Team, Training, User } from "./types";

export const APPROVAL_PENDING = "PENDING";
export const APPROVAL_APPROVED = "APPROVED";
export const APPROVAL_REJECTED = "REJECTED";

export const isAdmin = (u: User | null) => u?.role === "ADMIN";
export const isCoach = (u: User | null) => u?.role === "COACH";
export const canCreateContent = (u: User | null) => isAdmin(u) || isCoach(u);

/**
 * ¿Gestiona ESTE equipo? (rediseño multi-coach 2026-09-03 — antes cada
 * pantalla reinventaba `team.usercoach === uid` por su cuenta). El fundador
 * (`usercoach`) y cualquier co-entrenador aceptado (`coaches[uid]`) tienen
 * los mismos permisos de gestión — calendario, roster, alineaciones,
 * asistencia. Solo el fundador puede borrar el equipo o no puede
 * abandonarlo (ver isTeamFounder) — esa distinción SÍ importa y vive aparte.
 */
export function isTeamCoach(team: Team, uid: string | null | undefined): boolean {
  if (!uid) return false;
  return team.usercoach === uid || team.coaches[uid] === true;
}

/**
 * Cuerpo técnico a efectos de navegación: quien crea contenido (COACH/ADMIN),
 * dirige un club o entrena el equipo activo. El resto (jugadores y delegados)
 * ve la navegación de jugador y no los listados de la biblioteca (2026-09-30:
 * los entrenos y ejercicios los ven desde el Calendario).
 */
export function isStaffUser(profile: User | null, activeTeam: Team | null | undefined, uid: string | null | undefined): boolean {
  return (
    isCoach(profile) ||
    isAdmin(profile) ||
    Boolean(profile?.directorOfClubId) ||
    (activeTeam != null && isTeamCoach(activeTeam, uid))
  );
}

/** Delegado del equipo (2026-09-25): no es jugador ni entrenador. */
export function isTeamDelegate(team: Team, uid: string | null | undefined): boolean {
  return Boolean(uid) && team.delegates[uid!] === true;
}

/**
 * Logística del día: calendario, pasar lista, convocatoria, resultado y
 * avisos. Entrenadores y delegados; la alineación, el roster y las fichas
 * siguen siendo solo del entrenador (isTeamCoach).
 */
export function canManageEvents(team: Team, uid: string | null | undefined): boolean {
  return isTeamCoach(team, uid) || isTeamDelegate(team, uid);
}

/** El fundador del equipo — el único que no puede "salir" (debe borrar el equipo) y el único que puede quitar a un co-entrenador. */
export function isTeamFounder(team: Team, uid: string | null | undefined): boolean {
  return Boolean(uid) && team.usercoach === uid;
}

/** Club del que el usuario es miembro (`myClubId`, vía su propio equipo) y/o administra (`myAdminClubId`, vía `Clubs.adminUserId`) — resueltos por quien llama, ver useMyClubId()/useClub(). */
export type ClubContext = {
  myClubId?: string | null;
  myAdminClubId?: string | null;
  /**
   * Quién mira, para el público dentro del club (clubAudience, 2026-09-28).
   * Sin él (cargando) lo restringido solo lo ven autor y dirección.
   */
  audienceViewer?: AudienceViewer;
};

/** Contenido "Club" APROBADO: ¿lo ve este miembro según su público? */
function passesClubAudience(item: { clubAudience?: Audience | null; clubId?: string | null }, club: ClubContext): boolean {
  const audience = item.clubAudience;
  if (!audience || audience.kind === "club") return true;
  const isDirector = club.myAdminClubId != null && club.myAdminClubId === item.clubId;
  if (!club.audienceViewer) return isDirector;
  return canSeeAudience(audience, { ...club.audienceViewer, isDirector: club.audienceViewer.isDirector || isDirector });
}

/**
 * Espejo de PermissionsManager.canViewExercise:
 * - "Privado" → solo el autor
 * - "Club"    → autor + miembros del club (según aprobación: APPROVED=todo
 *   el club, PENDING=autor+admin del club, REJECTED/legacy=solo autor) —
 *   sin bypass de ADMIN global, igual que "Privado".
 * - "Publico" (y cualquier otro valor) → según approvalStatus:
 *   APPROVED=todos, PENDING=autor+admin, REJECTED=autor, null(legacy)=autor
 */
export function canViewExercise(user: User | null, exercise: Exercise, club: ClubContext = {}): boolean {
  if (user == null) return false;

  switch (exercise.privacy) {
    case "Privado":
      return exercise.author === user.username;

    case "Club": {
      if (exercise.author === user.username) return true;
      if (exercise.clubId == null || exercise.clubId !== club.myClubId) return false;
      switch (exercise.approvalStatus) {
        case APPROVAL_APPROVED:
          return passesClubAudience(exercise, club);
        case APPROVAL_PENDING:
          return club.myAdminClubId === exercise.clubId;
        default:
          return false; // REJECTED o legacy sin aprobación: solo el autor (ya cubierto arriba)
      }
    }

    default:
      switch (exercise.approvalStatus) {
        case APPROVAL_APPROVED:
          return true;
        case APPROVAL_PENDING:
          return isAdmin(user) || exercise.author === user.username;
        case APPROVAL_REJECTED:
          return exercise.author === user.username;
        case null:
        case undefined:
          return exercise.author === user.username; // legacy sin approvalStatus
        default:
          return false;
      }
  }
}

/** Espejo de PermissionsManager.canViewTraining (misma lógica que canViewExercise). */
export function canViewTraining(user: User | null, training: Training, club: ClubContext = {}): boolean {
  if (user == null) return false;

  switch (training.privacy) {
    case "Privado":
      return training.author === user.username;

    case "Club": {
      if (training.author === user.username) return true;
      if (training.clubId == null || training.clubId !== club.myClubId) return false;
      switch (training.approvalStatus) {
        case APPROVAL_APPROVED:
          return passesClubAudience(training, club);
        case APPROVAL_PENDING:
          return club.myAdminClubId === training.clubId;
        default:
          return false;
      }
    }

    default:
      switch (training.approvalStatus) {
        case APPROVAL_APPROVED:
          return true;
        case APPROVAL_PENDING:
          return isAdmin(user) || training.author === user.username;
        case APPROVAL_REJECTED:
          return training.author === user.username;
        case null:
        case undefined:
          return training.author === user.username;
        default:
          return false;
      }
  }
}

/**
 * Espejo de PermissionsManager.canEditExercise/canDeleteExercise (misma
 * lógica para ambas en Android): ADMIN cualquiera, COACH solo lo propio,
 * PLAYER nada.
 */
export function canEditExercise(user: User | null, exercise: Exercise): boolean {
  if (user == null) return false;
  if (isAdmin(user)) return true;
  if (isCoach(user)) return exercise.author === user.username;
  return false;
}
export const canDeleteExercise = canEditExercise;

/** Espejo de PermissionsManager.canEditTraining/canDeleteTraining. */
export function canEditTraining(user: User | null, training: Training): boolean {
  if (user == null) return false;
  if (isAdmin(user)) return true;
  if (isCoach(user)) return training.author === user.username;
  return false;
}
export const canDeleteTraining = canEditTraining;

/** Espejo de PermissionsManager.getRoleDisplayName. */
export function getRoleDisplayName(role: string | null | undefined): string {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "COACH":
      return "Entrenador";
    case "PLAYER":
      return "Jugador";
    default:
      return "Desconocido";
  }
}

// ── Lecciones del club (2026-09-28, solo web) ──
// Mismo criterio que el bloque ClubLessons de database.rules.json (repo Android).

/** Dirección del club: fundador, codirector o ADMIN. Aprueba y edita todas las lecciones. */
export function isClubDirector(club: Club | null | undefined, uid: string | null | undefined, profile: User | null): boolean {
  if (isAdmin(profile)) return true;
  if (!club || !uid) return false;
  return club.adminUserId === uid || club.directors[uid] === true;
}

/** ¿Puede crear carpetas y lecciones? La dirección, o un entrenador de su equipo activo si ese equipo es del club. */
export function canWriteClubLessons(opts: {
  isDirector: boolean;
  activeTeam: Team | null | undefined;
  clubId: string | null | undefined;
  uid: string | null | undefined;
}): boolean {
  if (opts.isDirector) return true;
  const { activeTeam, clubId, uid } = opts;
  return Boolean(activeTeam && clubId && activeTeam.clubId === clubId && isTeamCoach(activeTeam, uid));
}

/** Editar/borrar una carpeta o lección: la dirección, todo; un entrenador, solo lo suyo. */
export function canEditClubItem(item: { createdBy: string }, uid: string | null | undefined, isDirector: boolean, canWrite: boolean): boolean {
  return isDirector || (canWrite && Boolean(uid) && item.createdBy === uid);
}

// ── Documentos del equipo (2026-09-30, solo web) ──
// Mismo criterio que el bloque TeamDocs de database.rules.json (repo Android).

/** Crear, editar y borrar: fundador, co-entrenadores, delegados y ADMIN. */
export function canEditTeamDocs(team: Team, uid: string | null | undefined, profile: User | null): boolean {
  return isAdmin(profile) || canManageEvents(team, uid);
}

/** Lo del cuerpo técnico: quien edita y la dirección del club del equipo. */
export function canReadStaffDocs(
  team: Team,
  uid: string | null | undefined,
  profile: User | null,
  isDirectorOfTeamClub: boolean,
): boolean {
  return canEditTeamDocs(team, uid, profile) || isDirectorOfTeamClub;
}

/** Lo de todo el equipo: además, los jugadores del equipo. */
export function canReadTeamDocs(
  team: Team,
  uid: string | null | undefined,
  profile: User | null,
  isDirectorOfTeamClub: boolean,
): boolean {
  return canReadStaffDocs(team, uid, profile, isDirectorOfTeamClub) || (Boolean(uid) && team.userplayers[uid!] === true);
}
