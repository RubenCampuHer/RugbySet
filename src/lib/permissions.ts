// Port literal de PermissionsManager.kt (repo Android) — mantener en
// sincronía caso por caso. Es la única lógica de negocio real del MVP:
// decide qué contenido ve cada usuario según privacy × approvalStatus.
import type { Exercise, Training, User } from "./types";

export const APPROVAL_PENDING = "PENDING";
export const APPROVAL_APPROVED = "APPROVED";
export const APPROVAL_REJECTED = "REJECTED";

export const isAdmin = (u: User | null) => u?.role === "ADMIN";
export const isCoach = (u: User | null) => u?.role === "COACH";
export const canCreateContent = (u: User | null) => isAdmin(u) || isCoach(u);

/**
 * Espejo de PermissionsManager.canViewExercise:
 * - "Privado" → solo el autor
 * - "Equipo"  → autor + cualquier miembro del mismo equipo
 * - "Publico" (y cualquier otro valor) → según approvalStatus:
 *   APPROVED=todos, PENDING=autor+admin, REJECTED=autor, null(legacy)=autor
 */
export function canViewExercise(user: User | null, exercise: Exercise): boolean {
  if (user == null) return false;

  switch (exercise.privacy) {
    case "Privado":
      return exercise.author === user.username;

    case "Equipo":
      return (
        exercise.author === user.username ||
        (exercise.teamname != null &&
          exercise.teamname === user.teamname &&
          user.teamname != null)
      );

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

/** Espejo de PermissionsManager.canViewTraining (misma lógica). */
export function canViewTraining(user: User | null, training: Training): boolean {
  if (user == null) return false;

  switch (training.privacy) {
    case "Privado":
      return training.author === user.username;

    case "Equipo":
      return (
        training.author === user.username ||
        (training.teamname != null &&
          training.teamname === user.teamname &&
          user.teamname != null)
      );

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
