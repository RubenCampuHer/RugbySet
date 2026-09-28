// Lecciones del club (2026-09-28, solo web). Nodo ClubLessons/{clubId} — ver
// database.rules.json del repo Android (bloque ClubLessons): las reglas
// validan la misma forma, así que un campo nuevo aquí va también allí.
import { z } from "zod";
import { rtdbRecord } from "./common";

export const LESSON_BLOCK_TYPES = ["text", "pdf", "video", "board"] as const;
export type LessonBlockType = (typeof LESSON_BLOCK_TYPES)[number];

const TextBlock = z.object({ type: z.literal("text"), order: z.number(), text: z.string().catch("") });
const PdfBlock = z.object({
  type: z.literal("pdf"),
  order: z.number(),
  url: z.string(),
  path: z.string(),
  name: z.string().catch("documento.pdf"),
  size: z.number().nullish(),
});
const VideoBlock = z.object({
  type: z.literal("video"),
  order: z.number(),
  source: z.enum(["link", "file"]),
  url: z.string(),
  /** Solo si source = "file": ruta en Storage para borrarlo. */
  path: z.string().nullish(),
  title: z.string().nullish(),
});
const BoardBlock = z.object({
  type: z.literal("board"),
  order: z.number(),
  /** JSON {version:1, objects} de la pizarra (components/whiteboard/types.ts). */
  boardData: z.string(),
  title: z.string().nullish(),
});

export const LessonBlockSchema = z.discriminatedUnion("type", [TextBlock, PdfBlock, VideoBlock, BoardBlock]);
export type LessonBlock = z.infer<typeof LessonBlockSchema>;

export const LessonSchema = z.object({
  title: z.string().catch("Sin título"),
  folderId: z.string().nullish(),
  createdBy: z.string(),
  createdAt: z.number().catch(0),
  updatedAt: z.number().catch(0),
  // Un bloque que no encaja (tipo desconocido, datos rotos) se descarta en vez de tirar la lección.
  blocks: rtdbRecord(LessonBlockSchema.nullable().catch(null)).default({}),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const LessonFolderSchema = z.object({
  name: z.string().catch("Carpeta"),
  /** null/ausente = carpeta en la raíz. */
  parentId: z.string().nullish(),
  createdBy: z.string(),
  createdAt: z.number().catch(0),
});
export type LessonFolder = z.infer<typeof LessonFolderSchema>;

/** Parsea un mapa {id: valor} descartando las entradas que no validan. */
export function parseMap<T>(schema: z.ZodType<T>, raw: unknown): Record<string, T> {
  const out: Record<string, T> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = schema.safeParse(value);
    if (parsed.success) out[id] = parsed.data;
  }
  return out;
}
