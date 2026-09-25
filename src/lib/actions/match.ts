// Resultado del partido, vídeos y acta (2026-09-25, solo web):
// Teams/{t}/eventData/{yyyy-MM-dd}/match. Todo lo escribe el cuerpo técnico con
// el .write del equipo — sin reglas RTDB nuevas. El acta (PDF) va a Storage en
// match_reports/{equipo}/ (ver storage.rules del repo Android).
import { get, push, ref, set, update } from "firebase/database";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { eventDataKey } from "@/lib/attendance";
import { PATHS } from "@/lib/constants";
import { db, storage } from "@/lib/firebase";
import { MATCH_REPORT_MAX_BYTES, type MatchStatus, normalizeVideoUrl } from "@/lib/match";

function matchPath(teamname: string, fecha: string): string {
  const key = eventDataKey(fecha);
  if (!key) throw new Error("Fecha no válida");
  return `${PATHS.TEAMS}/${teamname}/eventData/${key}/match`;
}

/** Borra un fichero de Storage sin fallar si ya no existe (o no se deja). */
async function deleteFileQuietly(path: string | null | undefined): Promise<void> {
  if (!path) return;
  await deleteObject(storageRef(storage, path)).catch(() => {});
}

export type MatchResultInput = {
  opponent: string | null;
  home: boolean | null;
  status: MatchStatus;
  pointsFor: number | null;
  pointsAgainst: number | null;
  triesFor: number | null;
  triesAgainst: number | null;
};

/** Guarda el resultado sin tocar vídeos ni acta (update por hijos). */
export async function saveMatchResult(teamname: string, fecha: string, input: MatchResultInput): Promise<void> {
  await update(ref(db, matchPath(teamname, fecha)), {
    opponent: input.opponent?.trim().slice(0, 80) || null,
    home: input.home,
    status: input.status,
    pointsFor: input.pointsFor,
    pointsAgainst: input.pointsAgainst,
    triesFor: input.triesFor,
    triesAgainst: input.triesAgainst,
    updatedAt: Date.now(),
  });
}

export async function addMatchVideo(
  teamname: string,
  fecha: string,
  video: { url: string; title: string | null },
): Promise<void> {
  const url = normalizeVideoUrl(video.url);
  if (!url) throw new Error("El enlace no es válido (tiene que empezar por https://)");
  await push(ref(db, `${matchPath(teamname, fecha)}/videos`), {
    url,
    title: video.title?.trim().slice(0, 80) || null,
    addedAt: Date.now(),
  });
}

export async function removeMatchVideo(teamname: string, fecha: string, videoId: string): Promise<void> {
  await set(ref(db, `${matchPath(teamname, fecha)}/videos/${videoId}`), null);
}

/**
 * Sube el acta (PDF, < 10 MB) y sustituye la anterior. El fichero viejo se
 * borra después de apuntar al nuevo: si algo falla a medias, como mucho queda
 * un fichero de más, nunca un acta rota.
 */
export async function uploadMatchReport(teamname: string, fecha: string, file: File): Promise<void> {
  if (file.type !== "application/pdf") throw new Error("El acta tiene que ser un PDF");
  if (file.size >= MATCH_REPORT_MAX_BYTES) throw new Error("El PDF pesa más de 10 MB");
  const key = eventDataKey(fecha);
  if (!key) throw new Error("Fecha no válida");

  const path = `match_reports/${teamname}/${key}-${Date.now()}.pdf`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file, { contentType: "application/pdf" });
  const url = await getDownloadURL(fileRef);

  const reportRef = ref(db, `${matchPath(teamname, fecha)}/report`);
  const previous = (await get(reportRef)).val() as { path?: string } | null;
  await set(reportRef, { url, path, name: file.name.slice(0, 120), uploadedAt: Date.now() });
  if (previous?.path !== path) await deleteFileQuietly(previous?.path);
}

export async function removeMatchReport(teamname: string, fecha: string): Promise<void> {
  const reportRef = ref(db, `${matchPath(teamname, fecha)}/report`);
  const previous = (await get(reportRef)).val() as { path?: string } | null;
  await set(reportRef, null);
  await deleteFileQuietly(previous?.path);
}

/**
 * Al borrar un día: fuera sus datos de eventData (asistencia real, motivos,
 * partido) y el acta, para que un evento nuevo en esa fecha empiece limpio.
 */
export async function clearEventData(teamname: string, fecha: string): Promise<void> {
  const key = eventDataKey(fecha);
  if (!key) return;
  const dataRef = ref(db, `${PATHS.TEAMS}/${teamname}/eventData/${key}`);
  const reportPath = (await get(ref(db, `${PATHS.TEAMS}/${teamname}/eventData/${key}/match/report/path`))).val();
  await set(dataRef, null);
  await deleteFileQuietly(typeof reportPath === "string" ? reportPath : null);
}

/**
 * Convocatoria (eventData/{día}/squad): convocados y si la ven los jugadores.
 * `publishedAt` guarda la primera vez que se hizo visible.
 */
export async function saveSquad(
  teamname: string,
  fecha: string,
  squad: { players: string[]; visible: boolean },
): Promise<void> {
  const key = eventDataKey(fecha);
  if (!key) throw new Error("Fecha no válida");
  const squadRef = ref(db, `${PATHS.TEAMS}/${teamname}/eventData/${key}/squad`);
  const prevPublished = (await get(ref(db, `${PATHS.TEAMS}/${teamname}/eventData/${key}/squad/publishedAt`))).val();
  const players = Object.fromEntries(squad.players.map((uid) => [uid, true]));
  await set(squadRef, {
    players: squad.players.length > 0 ? players : null,
    visible: squad.visible,
    publishedAt: squad.visible ? (typeof prevPublished === "number" ? prevPublished : Date.now()) : null,
    updatedAt: Date.now(),
  });
}
