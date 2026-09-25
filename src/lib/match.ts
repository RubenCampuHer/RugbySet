// Resultado del partido (2026-09-25, solo web): Teams/{t}/eventData/{yyyy-MM-dd}/match.
// Lógica pura — sin Firebase — para el panel del día y la agenda.
import { eventDataKey } from "./attendance";
import type { Match, Team, TrainingDay } from "./types";

export const MATCH_STATUSES = ["pending", "played", "abandoned"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  pending: "Sin jugar",
  played: "Jugado",
  abandoned: "Suspendido",
};

export type MatchOutcome = "win" | "draw" | "loss";

export const MATCH_OUTCOME_LABEL: Record<MatchOutcome, string> = {
  win: "Victoria",
  draw: "Empate",
  loss: "Derrota",
};

/** Letra corta para la agenda: V / E / D. */
export const MATCH_OUTCOME_SHORT: Record<MatchOutcome, string> = { win: "V", draw: "E", loss: "D" };

export function matchOf(team: Team, day: TrainingDay): Match | null {
  const key = day.fecha ? eventDataKey(day.fecha) : null;
  return (key && team.eventData[key]?.match) || null;
}

/** Solo hay resultado si el partido se jugó y tiene los dos marcadores. */
export function matchOutcome(match: Match | null | undefined): MatchOutcome | null {
  if (!match || match.status !== "played") return null;
  const { pointsFor: f, pointsAgainst: a } = match;
  if (f == null || a == null) return null;
  return f > a ? "win" : f < a ? "loss" : "draw";
}

/**
 * "Nosotros – Rival" en casa y "Rival – Nosotros" fuera, como se lee un
 * marcador; devuelve los puntos en ese orden.
 */
export function scoreline(match: Match): string | null {
  const { pointsFor: f, pointsAgainst: a } = match;
  if (f == null || a == null) return null;
  return match.home === false ? `${a} – ${f}` : `${f} – ${a}`;
}

/** Entero ≥ 0 a partir de lo que escribe el usuario ("" = sin dato). */
export function parseScore(value: string): number | null | "invalid" {
  const v = value.trim();
  if (v === "") return null;
  if (!/^\d{1,3}$/.test(v)) return "invalid";
  return Number(v);
}

/** Id de vídeo de YouTube (watch, youtu.be, shorts, embed, live) o null. */
export function youtubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
      id = m ? m[1] : null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Solo enlaces http(s) — nada de javascript: ni similares en un href. */
export function normalizeVideoUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Nombre legible del sitio del vídeo cuando no hay título. */
export function videoSiteLabel(url: string): string {
  if (youtubeId(url)) return "YouTube";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Vídeo";
  }
}

export const MATCH_REPORT_MAX_BYTES = 10 * 1024 * 1024;
