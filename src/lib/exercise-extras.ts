// Lógica pura del vídeo y los niveles de un ejercicio (2026-09-29).
import { normalizeVideoUrl } from "@/lib/match";
import type { ExerciseExtras, ExerciseLevel, VideoRef } from "@/lib/schemas/exercise-extras";

export const EXERCISE_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const LEVEL_NAME_MAX = 60;
export const LEVEL_DESC_MAX = 4000;

/** Mensaje de error si el fichero no vale (mismos límites que storage.rules). */
export function validateExerciseVideo(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith("video/")) return "Tiene que ser un vídeo.";
  if (file.size >= EXERCISE_VIDEO_MAX_BYTES) return "El vídeo no puede pasar de 200 MB.";
  return null;
}

export type LevelEntry = { id: string; level: ExerciseLevel };

/** Niveles en su orden (los rotos ya vienen como null y se saltan). */
export function sortedLevels(extras: Pick<ExerciseExtras, "levels"> | null | undefined): LevelEntry[] {
  if (!extras) return [];
  return Object.entries(extras.levels)
    .filter((e): e is [string, ExerciseLevel] => e[1] != null)
    .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
    .map(([id, level]) => ({ id, level }));
}

export function levelCount(extras: Pick<ExerciseExtras, "levels"> | null | undefined): number {
  return sortedLevels(extras).length;
}

/** Rutas de Storage de los vídeos subidos que usa. */
export function extrasFiles(extras: Pick<ExerciseExtras, "video" | "levels"> | null | undefined): string[] {
  if (!extras) return [];
  const videos = [extras.video, ...sortedLevels(extras).map((e) => e.level.video)];
  return videos.flatMap((v) => (v?.source === "file" && v.path ? [v.path] : []));
}

/**
 * Ficheros de `paths` que ya no usa nadie: ni `kept` (lo que se guarda ahora)
 * ni los extras de otros ejercicios (una copia de un ejercicio comparte los
 * vídeos subidos con el original).
 */
export function unusedFiles(
  paths: string[],
  kept: Pick<ExerciseExtras, "video" | "levels"> | null,
  others: Record<string, Pick<ExerciseExtras, "video" | "levels"> | null>,
): string[] {
  const used = new Set([...extrasFiles(kept), ...Object.values(others).flatMap((x) => extrasFiles(x))]);
  return [...new Set(paths)].filter((p) => !used.has(p));
}

export type ExtrasDraft = { video: VideoRef | null; levels: LevelEntry[] };

/**
 * Borrador del editor → datos para RTDB: niveles sin nombre fuera, orden
 * 0..n-1, enlaces solo http(s), textos recortados. Error legible si algo no vale.
 */
export function cleanExtrasDraft(
  draft: ExtrasDraft,
): { ok: true; video: VideoRef | null; levels: Record<string, ExerciseLevel> } | { ok: false; error: string } {
  const cleanVideo = (v: VideoRef | null, where: string): VideoRef | null | string => {
    if (!v) return null;
    if (v.source === "link") {
      if (!v.url.trim()) return null;
      const url = normalizeVideoUrl(v.url);
      if (!url) return `El enlace del vídeo ${where} no es válido (tiene que empezar por https://)`;
      return { source: "link", url, title: v.title?.trim().slice(0, 120) || null };
    }
    return { source: "file", url: v.url, path: v.path ?? null, title: v.title?.trim().slice(0, 120) || null };
  };
  const video = cleanVideo(draft.video, "del ejercicio");
  if (typeof video === "string") return { ok: false, error: video };
  const levels: Record<string, ExerciseLevel> = {};
  let order = 0;
  for (const { id, level } of draft.levels) {
    const name = level.name.trim();
    const desc = level.desc?.trim() ?? "";
    const v = cleanVideo(level.video ?? null, `del nivel "${name || order + 1}"`);
    if (typeof v === "string") return { ok: false, error: v };
    if (!name) {
      if (desc || v) return { ok: false, error: `Ponle nombre al nivel ${order + 1}` };
      continue;
    }
    if (name.length > LEVEL_NAME_MAX) return { ok: false, error: `El nombre "${name}" es demasiado largo` };
    levels[id] = { name, desc: desc.slice(0, LEVEL_DESC_MAX) || null, order, video: v };
    order++;
  }
  return { ok: true, video, levels };
}

/** Quita los null (RTDB los interpreta como borrar y las reglas no los esperan). */
export function toRtdb(video: VideoRef | null, levels: Record<string, ExerciseLevel>, uid: string, now: number) {
  const stripVideo = (v: VideoRef | null | undefined) =>
    v ? { source: v.source, url: v.url, ...(v.path ? { path: v.path } : {}), ...(v.title ? { title: v.title } : {}) } : undefined;
  const out: Record<string, unknown> = { updatedAt: now, updatedBy: uid };
  const sv = stripVideo(video);
  if (sv) out.video = sv;
  const ls = Object.fromEntries(
    Object.entries(levels).map(([id, l]) => {
      const lv = stripVideo(l.video);
      return [id, { name: l.name, order: l.order, ...(l.desc ? { desc: l.desc } : {}), ...(lv ? { video: lv } : {}) }];
    }),
  );
  if (Object.keys(ls).length) out.levels = ls;
  return out;
}

/** ¿Hay algo que guardar? (sin vídeo ni niveles se borra el nodo). */
export function isEmptyExtras(video: VideoRef | null, levels: Record<string, ExerciseLevel>): boolean {
  return !video && Object.keys(levels).length === 0;
}
