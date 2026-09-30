// Documentos del equipo (2026-09-30, solo web). Nodo TeamDocs/{teamname}/{team|staff}
// — ver database.rules.json del repo Android (bloque TeamDocs): las reglas
// validan la misma forma, así que un campo nuevo aquí va también allí.
import { z } from "zod";
import { rtdbRecord } from "./common";
import { LessonBlockSchema } from "./lesson";

export const TEAM_DOC_SPACES = ["team", "staff"] as const;
export type TeamDocSpace = (typeof TEAM_DOC_SPACES)[number];

export const TeamDocFolderSchema = z.object({
  name: z.string().catch("Carpeta"),
  /** null/ausente = en la raíz. */
  parentId: z.string().nullish(),
  createdBy: z.string().catch(""),
  createdAt: z.number().catch(0),
});
export type TeamDocFolder = z.infer<typeof TeamDocFolderSchema>;

export const TeamDocSchema = z.object({
  title: z.string().catch("Sin título"),
  folderId: z.string().nullish(),
  createdBy: z.string().catch(""),
  createdAt: z.number().catch(0),
  updatedAt: z.number().catch(0),
  updatedBy: z.string().nullish(),
  // Mismos bloques que las lecciones del club; uno roto se descarta.
  blocks: rtdbRecord(LessonBlockSchema.nullable().catch(null)).default({}),
});
export type TeamDoc = z.infer<typeof TeamDocSchema>;

export const TeamFileSchema = z.object({
  name: z.string().catch("archivo"),
  folderId: z.string().nullish(),
  url: z.string(),
  /** Ruta en Storage (team_docs/{equipo}/…) para borrarlo. */
  path: z.string(),
  size: z.number().nullish(),
  contentType: z.string().nullish(),
  createdBy: z.string().catch(""),
  createdAt: z.number().catch(0),
});
export type TeamFile = z.infer<typeof TeamFileSchema>;

export const TeamDocsSpaceSchema = z.object({
  folders: rtdbRecord(TeamDocFolderSchema.nullable().catch(null)).default({}),
  docs: rtdbRecord(TeamDocSchema.nullable().catch(null)).default({}),
  files: rtdbRecord(TeamFileSchema.nullable().catch(null)).default({}),
});
export type TeamDocsSpaceData = z.infer<typeof TeamDocsSpaceSchema>;
