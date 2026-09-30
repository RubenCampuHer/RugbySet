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
  // Lecciones del club (2026-09-28, solo web): ClubLessons/{clubId}/{folders,lessons,pending,pendingBy}.
  // Nodo raíz aparte porque Clubs se puede leer sin ser del club.
  CLUB_LESSONS: "ClubLessons",
  // Documentos del equipo (2026-09-30, solo web): TeamDocs/{teamname}/{team|staff}/{folders,docs,files}.
  // Aparte de Teams (Android no lo conoce); renameTeam y adminDeleteTeam lo mueven/borran.
  TEAM_DOCS: "TeamDocs",
  EXERCISES: "Exercises",
  // Vídeo y niveles de cada ejercicio (2026-09-29, solo web): ExerciseExtras/{nombre}.
  // Aparte porque las versiones publicadas de Android reescriben Exercises/{n} entero.
  EXERCISE_EXTRAS: "ExerciseExtras",
  TRAININGS: "Trainings",
  NOTIFICATIONS: "notifications", // hijo de Users/{uid}
  TRAINING_DAYS: "trainingdays", // hijo de Teams/{t} (FirebasePaths.TRAINING_DAYS)
} as const;
