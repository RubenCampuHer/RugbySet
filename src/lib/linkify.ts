// URLs dentro de texto libre (descripciones de ejercicios, niveles, lecciones)
// → trozos de texto y enlaces (2026-09-30). Muchos ejercicios traen
// "Referencias: https://…" que antes salían como texto sin poder pulsarlos.
import { normalizeVideoUrl } from "@/lib/match";

export type TextPart = { type: "text"; value: string } | { type: "link"; url: string; label: string };

const URL_RE = /https?:\/\/[^\s<>"]+/g;
// Puntuación pegada al final que casi nunca es parte de la URL.
const TRAILING = /[.,;:!?'"»)\]]+$/;
const LABEL_MAX = 40;

/** Texto visible del enlace: host sin www. + ruta, recortado. */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const text = u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
    return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text;
  } catch {
    return url;
  }
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  const push = (value: string) => {
    if (!value) return;
    const prev = parts[parts.length - 1];
    if (prev?.type === "text") prev.value += value;
    else parts.push({ type: "text", value });
  };
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let raw = m[0];
    const trail = TRAILING.exec(raw)?.[0] ?? "";
    if (trail) raw = raw.slice(0, raw.length - trail.length);
    push(text.slice(last, start));
    const url = normalizeVideoUrl(raw);
    if (url) parts.push({ type: "link", url: raw, label: linkLabel(raw) });
    else push(raw);
    push(trail);
    last = start + m[0].length;
  }
  push(text.slice(last));
  return parts;
}

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com|instagram\.com|vimeo\.com|tiktok\.com)$/;

/** Enlace a un sitio de vídeo (YouTube, Instagram, Vimeo, TikTok). */
export function isVideoSite(url: string): boolean {
  try {
    return VIDEO_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** URLs del texto, en orden y sin repetir. */
export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const urls = splitLinks(text).flatMap((p) => (p.type === "link" ? [p.url] : []));
  return [...new Set(urls)];
}
