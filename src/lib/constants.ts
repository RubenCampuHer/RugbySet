// Espejo de FirebasePaths.kt del repo Android (RugbyApplication).
// ⚠️ Cualquier cambio de nombre de nodo debe propagarse a ambos repos.
export const PATHS = {
  USERS: "Users",
  PUBLIC_PROFILES: "publicProfiles", // proyección mantenida por la Cloud Function mirrorPublicProfile
  TEAMS: "Teams",
  CLUBS: "Clubs",
  EXERCISES: "Exercises",
  TRAININGS: "Trainings",
  NOTIFICATIONS: "notifications", // hijo de Users/{uid}
} as const;
