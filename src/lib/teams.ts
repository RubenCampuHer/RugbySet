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

/**
 * ¿Sigue este usuario en el equipo? (2026-09-30) Miembro = fundador,
 * co-entrenador, jugador o delegado; "pending" = ha pedido entrar y el
 * entrenador aún no le ha aceptado. Lo usa reconcileActiveTeam para no
 * volver a dar por miembro a quien ya salió o fue expulsado.
 */
export function rosterStatus(
  team: {
    usercoach?: string | null;
    coaches?: Record<string, unknown>;
    userplayers?: Record<string, unknown>;
    delegates?: Record<string, unknown>;
    pendingplayers?: Record<string, unknown>;
  } | null,
  uid: string,
): "member" | "pending" | "none" {
  if (!team) return "none";
  if (
    team.usercoach === uid ||
    team.coaches?.[uid] === true ||
    team.userplayers?.[uid] === true ||
    team.delegates?.[uid] === true
  ) {
    return "member";
  }
  return team.pendingplayers?.[uid] === true ? "pending" : "none";
}
