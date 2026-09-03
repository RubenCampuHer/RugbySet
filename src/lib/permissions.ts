// Port literal de PermissionsManager.kt (repo Android) — mantener en
// sincronía caso por caso. Es la única lógica de negocio real del MVP:
// decide qué contenido ve cada usuario según privacy × approvalStatus.
import type { Exercise, Team, Training, User } from "./types";

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

/** El fundador del equipo — el único que no puede "salir" (debe borrar el equipo) y el único que puede quitar a un co-entrenador. */
export function isTeamFounder(team: Team, uid: string | null | undefined): boolean {
  return Boolean(uid) && team.usercoach === uid;
}

/** Club del que el usuario es miembro (`myClubId`, vía su propio equipo) y/o administra (`myAdminClubId`, vía `Clubs.adminUserId`) — resueltos por quien llama, ver useMyClubId()/useClub(). */
export type ClubContext = { myClubId?: string | null; myAdminClubId?: string | null };

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
          return true;
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
          return true;
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
