// Documentos del equipo (2026-09-30, solo web): TeamDocs/{equipo}/{team|staff}.
// Quién escribe lo deciden las reglas (fundador, co-entrenadores, delegados,
// ADMIN); cada documento, carpeta y archivo es su propio nodo, así que un
// set() del elemento no pisa nada de otros.
import { push, ref, set, update } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { PATHS } from "@/lib/constants";
import { auth, db, storage } from "@/lib/firebase";
import type { TeamDoc, TeamDocSpace } from "@/lib/schemas/team-docs";
import { deleteFileQuietly } from "@/lib/storage";
import { docFiles, folderMovePaths, type ItemKind, type MergedDocs, spaceMovePaths, validateTeamFile } from "@/lib/team-docs";

const base = (teamname: string) => `${PATHS.TEAM_DOCS}/${teamname}`;
const uidOrThrow = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No autenticado");
  return uid;
};

/** Id nuevo (vale para cualquier colección y espacio). */
export function newTeamDocId(teamname: string): string {
  return push(ref(db, `${base(teamname)}/team/docs`)).key!;
}

export async function deleteTeamFiles(paths: string[]): Promise<void> {
  await Promise.all([...new Set(paths)].map((p) => deleteFileQuietly(p)));
}

// ── Carpetas ──

export async function createTeamFolder(
  teamname: string,
  space: TeamDocSpace,
  name: string,
  parentId: string | null,
): Promise<string> {
  const id = newTeamDocId(teamname);
  await set(ref(db, `${base(teamname)}/${space}/folders/${id}`), {
    name: name.trim().slice(0, 120),
    ...(parentId ? { parentId } : {}),
    createdBy: uidOrThrow(),
    createdAt: Date.now(),
  });
  return id;
}

export async function renameTeamFolder(teamname: string, space: TeamDocSpace, id: string, name: string): Promise<void> {
  await set(ref(db, `${base(teamname)}/${space}/folders/${id}/name`), name.trim().slice(0, 120));
}

/** Solo carpetas vacías (lo comprueba la pantalla con countIn). */
export async function deleteTeamFolder(teamname: string, space: TeamDocSpace, id: string): Promise<void> {
  await set(ref(db, `${base(teamname)}/${space}/folders/${id}`), null);
}

// ── Visibilidad y carpeta ──

export async function setTeamDocSpace(
  teamname: string,
  m: MergedDocs,
  kind: ItemKind,
  id: string,
  to: TeamDocSpace,
): Promise<void> {
  const paths = spaceMovePaths(teamname, m, kind, id, to);
  if (Object.keys(paths).length) await update(ref(db), paths);
}

export async function moveTeamDocItem(
  teamname: string,
  m: MergedDocs,
  kind: ItemKind,
  id: string,
  target: string | null,
): Promise<void> {
  const paths = folderMovePaths(teamname, m, kind, id, target);
  if (Object.keys(paths).length) await update(ref(db), paths);
}

// ── Documentos ──

export type TeamDocDraft = Pick<TeamDoc, "title" | "folderId" | "blocks">;

/**
 * Guarda el documento en `space` (si antes estaba en el otro espacio, lo
 * mueve en la misma escritura) y borra de Storage lo que ya no usa.
 */
export async function saveTeamDoc(opts: {
  teamname: string;
  id: string;
  space: TeamDocSpace;
  draft: TeamDocDraft;
  previous: { space: TeamDocSpace; doc: TeamDoc } | null;
  uploadedInEditor: string[];
}): Promise<void> {
  const { teamname, id, space, draft, previous, uploadedInEditor } = opts;
  const uid = uidOrThrow();
  const title = draft.title.trim();
  if (!title) throw new Error("Ponle un título al documento");
  const now = Date.now();
  const value = {
    title: title.slice(0, 120),
    ...(draft.folderId ? { folderId: draft.folderId } : {}),
    createdBy: previous?.doc.createdBy || uid,
    createdAt: previous?.doc.createdAt || now,
    updatedAt: now,
    updatedBy: uid,
    blocks: draft.blocks,
  };
  const paths: Record<string, unknown> = { [`${base(teamname)}/${space}/docs/${id}`]: value };
  if (previous && previous.space !== space) paths[`${base(teamname)}/${previous.space}/docs/${id}`] = null;
  await update(ref(db), paths);
  const used = new Set(docFiles({ blocks: draft.blocks }));
  await deleteTeamFiles([...docFiles(previous?.doc), ...uploadedInEditor].filter((p) => !used.has(p)));
}

export async function deleteTeamDoc(teamname: string, space: TeamDocSpace, id: string, doc: TeamDoc): Promise<void> {
  await set(ref(db, `${base(teamname)}/${space}/docs/${id}`), null);
  await deleteTeamFiles(docFiles(doc));
}

// ── Archivos ──

export type UploadedTeamFile = { url: string; path: string; name: string; size: number; contentType: string };

/** Sube cualquier archivo (< 200 MB) a team_docs/{equipo}/ con progreso (0-1). */
export async function uploadTeamFile(
  teamname: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedTeamFile> {
  uidOrThrow();
  const error = validateTeamFile(file);
  if (error) throw new Error(error);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "archivo";
  const path = `team_docs/${teamname}/${Date.now()}-${safeName}`;
  const fileRef = storageRef(storage, path);
  const contentType = file.type || "application/octet-stream";
  const task = uploadBytesResumable(fileRef, file, { contentType });
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(),
    );
  });
  return { url: await getDownloadURL(fileRef), path, name: file.name.slice(0, 200), size: file.size, contentType };
}

/** Registra un archivo ya subido en la carpeta y con la visibilidad elegidas. */
export async function addTeamFile(
  teamname: string,
  space: TeamDocSpace,
  folderId: string | null,
  up: UploadedTeamFile,
): Promise<void> {
  const id = newTeamDocId(teamname);
  await set(ref(db, `${base(teamname)}/${space}/files/${id}`), {
    name: up.name,
    ...(folderId ? { folderId } : {}),
    url: up.url,
    path: up.path,
    size: up.size,
    contentType: up.contentType.slice(0, 200),
    createdBy: uidOrThrow(),
    createdAt: Date.now(),
  });
}

export async function renameTeamFile(teamname: string, space: TeamDocSpace, id: string, name: string): Promise<void> {
  await set(ref(db, `${base(teamname)}/${space}/files/${id}/name`), name.trim().slice(0, 200));
}

export async function deleteTeamFile(teamname: string, space: TeamDocSpace, id: string, path: string): Promise<void> {
  await set(ref(db, `${base(teamname)}/${space}/files/${id}`), null);
  await deleteTeamFiles([path]);
}
