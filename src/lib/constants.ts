// Espejo de FirebasePaths.kt del repo Android (RugbyApplication).
// ⚠️ Cualquier cambio de nombre de nodo debe propagarse a ambos repos.
// Excepción: USER_TEAMS es un nodo SOLO de la web — Android no lo conoce ni
// lo necesita (sigue viendo un único equipo vía Users/{uid}/teamname).
export const PATHS = {
  USERS: "Users",
  PUBLIC_PROFILES: "publicProfiles", // proyección mantenida por la Cloud Function mirrorPublicProfile
  // Varios equipos por usuario (fase 1, 2026-09-04): UserTeams/{uid}/{teamname}: true.
  // Fuera de Users/{uid} a propósito — Android reescribe ese nodo entero
  // (setValue) y borraría cualquier campo nuevo. Users.teamname = equipo ACTIVO.
  USER_TEAMS: "UserTeams",
  TEAMS: "Teams",
  CLUBS: "Clubs",
  EXERCISES: "Exercises",
  TRAININGS: "Trainings",
  NOTIFICATIONS: "notifications", // hijo de Users/{uid}
} as const;
