// Lógica pura de "varios equipos por usuario" (sin Firebase) — testeable.

/**
 * Qué equipo pasa a ser el ACTIVO cuando el actual deja de valer (salir,
 * expulsión, borrado): el primero por orden alfabético de los que quedan, o
 * null si no queda ninguno. Mismo criterio que la Cloud Function leaveTeam
 * (functions/index.js del repo Android) — mantener en sincronía.
 */
export function nextActiveTeam(teams: readonly string[], exclude?: string | null): string | null {
  const remaining = teams.filter((t) => t && t !== exclude);
  if (remaining.length === 0) return null;
  return [...remaining].sort((a, b) => a.localeCompare(b, "es"))[0];
}
