// Invitaciones por enlace (2026-09-25). El enlace solo lleva el código de
// siempre: no da acceso directo, ahorra escribirlo. Ingreso con aprobación,
// igual que por código (Cloud Function joinTeamByCode / pendingTeams del club).

export type InviteRole = "player" | "coach";

const FALLBACK_ORIGIN = "https://rugbyset.web.app";

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : FALLBACK_ORIGIN;
}

/** Enlace para unirse a un equipo; `coach` pide entrar como co-entrenador. */
export function teamInviteUrl(teamcode: string, role: InviteRole = "player", base = origin()): string {
  const params = new URLSearchParams({ code: teamcode });
  if (role === "coach") params.set("as", "coach");
  return `${base}/join?${params.toString()}`;
}

/** Enlace para que el entrenador de un equipo pida entrar en el club. */
export function clubInviteUrl(clubcode: string, base = origin()): string {
  return `${base}/join-club?${new URLSearchParams({ code: clubcode }).toString()}`;
}

/**
 * Destino tras login/onboarding (?next=): solo rutas internas ("/..."), nunca
 * "//host" ni URLs absolutas — evita un redirector abierto.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** Lee ?next= de la URL actual (solo en cliente). */
export function readNextParam(): string | null {
  if (typeof window === "undefined") return null;
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

/** "?next=<ruta actual>" para mandar a login/onboarding y volver aquí después; "" desde el inicio. */
export function nextSuffix(): string {
  if (typeof window === "undefined") return "";
  const here = window.location.pathname + window.location.search;
  return here === "/" || here === "/home" ? "" : `?next=${encodeURIComponent(here)}`;
}

/** Código de equipo de un ?next= que apunte a /join (para rellenarlo en el onboarding). */
export function teamCodeFromNext(next: string | null): string | null {
  if (!next) return null;
  const url = new URL(next, FALLBACK_ORIGIN);
  return url.pathname === "/join" ? url.searchParams.get("code") : null;
}
