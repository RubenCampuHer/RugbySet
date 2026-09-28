"use client";

import {
  ArrowDown,
  ArrowUp,
  FileText,
  Folder,
  Link2,
  Lock,
  PenTool,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { FolderPickerDialog } from "@/components/lessons/LessonDialogs";
import { LessonBlockView } from "@/components/lessons/LessonBlocksView";
import { VideoLinkCard } from "@/components/media/VideoLinkCard";
import { DetailSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BoardSvg } from "@/components/whiteboard/BoardSvg";
import { parseBoardData } from "@/components/whiteboard/types";
import { WhiteboardDialog } from "@/components/whiteboard/WhiteboardDialog";
import { useClubLessons, useLessonsClub, usePendingLessons } from "@/hooks/useClubLessons";
import { discardUploads, newLessonId, saveLesson, uploadLessonFile } from "@/lib/actions/lessons";
import { breadcrumb, lessonFiles, moveBlock, sortedBlocks, toBlocksRecord, validateLessonFile, type BlockEntry } from "@/lib/lessons";
import { normalizeVideoUrl } from "@/lib/match";
import { canEditClubItem } from "@/lib/permissions";
import type { LessonBlock } from "@/lib/schemas/lesson";

let localSeq = 0;
/** Id local de bloque (clave RTDB válida, sin push para no depender de la red). */
const blockId = () => `b${Date.now().toString(36)}${(localSeq++).toString(36)}`;

const BLOCK_LABEL: Record<LessonBlock["type"], string> = { text: "Texto", pdf: "PDF", video: "Vídeo", board: "Jugada" };

type UploadState = { kind: "pdf" | "video"; name: string; progress: number };

function LessonEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const editingId = params.get("id");
  const initialFolder = params.get("folder");
  const { uid, clubId, isDirector, canWrite, loading } = useLessonsClub();
  const { folders, lessons, loading: loadingLessons } = useClubLessons(clubId);
  const { pending: pendingMap, loading: loadingPending } = usePendingLessons(clubId, uid, isDirector);

  const [lessonId, setLessonId] = useState<string | null>(editingId);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(initialFolder);
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  /** Ficheros subidos en esta sesión del editor (para borrarlos si no se guardan). */
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [uploading, setUploading] = useState<UploadState | null>(null);
  const [board, setBoard] = useState<{ id: string | null; data: string | null } | null>(null);
  const [pickFolder, setPickFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const approved = editingId ? (lessons[editingId] ?? null) : null;
  const pending = editingId ? (pendingMap[editingId] ?? null) : null;
  const source = pending ?? approved;
  const ready = !loading && !loadingLessons && !loadingPending && Boolean(clubId);

  // Carga inicial (una vez): la versión pendiente si la hay, si no la publicada. Ajuste en render, sin efecto.
  if (ready && !loaded && (!editingId || source)) {
    setLoaded(true);
    if (source) {
      setTitle(source.title);
      setFolderId(source.folderId ?? null);
      setBlocks(sortedBlocks(source));
    }
  }
  if (ready && clubId && !lessonId) setLessonId(newLessonId(clubId));

  if (!ready || (editingId && !loaded && !source && loadingLessons)) return <DetailSkeleton />;
  if (!canWrite || (source && !canEditClubItem(source, uid, isDirector, canWrite))) {
    return (
      <EmptyState
        icon={Lock}
        title="No puedes editar esta lección"
        hint="Crean lecciones la dirección y los entrenadores del club; cada entrenador edita las suyas."
      />
    );
  }
  if (editingId && !source) {
    return <EmptyState icon={FileText} title="Lección no encontrada" />;
  }

  const path = breadcrumb(folders, folderId);
  const update = (id: string, patch: Partial<LessonBlock>) =>
    setBlocks((list) => list.map((e) => (e.id === id ? { ...e, block: { ...e.block, ...patch } as LessonBlock } : e)));
  const add = (block: LessonBlock) => setBlocks((list) => [...list, { id: blockId(), block }]);
  const remove = (id: string) => setBlocks((list) => list.filter((e) => e.id !== id));

  const onFile = async (kind: "pdf" | "video", file: File | undefined) => {
    if (!file || !clubId || !lessonId) return;
    const error = validateLessonFile(kind, file);
    if (error) {
      toast.error(error);
      return;
    }
    setUploading({ kind, name: file.name, progress: 0 });
    try {
      const up = await uploadLessonFile(clubId, lessonId, kind, file, (progress) =>
        setUploading((u) => (u ? { ...u, progress } : u)),
      );
      setUploaded((list) => [...list, up.path]);
      add(
        kind === "pdf"
          ? { type: "pdf", order: 0, url: up.url, path: up.path, name: up.name, size: up.size }
          : { type: "video", order: 0, source: "file", url: up.url, path: up.path, title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el fichero");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!clubId || !lessonId || !uid) return;
    if (!title.trim()) {
      toast.error("Ponle un título a la lección");
      return;
    }
    // Enlaces de vídeo: solo http(s); los vacíos se quitan.
    const cleaned: BlockEntry[] = [];
    for (const entry of blocks) {
      const b = entry.block;
      if (b.type === "video" && b.source === "link") {
        if (!b.url.trim()) continue;
        const url = normalizeVideoUrl(b.url);
        if (!url) {
          toast.error("Hay un enlace de vídeo que no es válido (tiene que empezar por https://)");
          return;
        }
        cleaned.push({ ...entry, block: { ...b, url, title: b.title?.trim() || null } });
      } else if (b.type === "text") {
        if (b.text.trim()) cleaned.push(entry);
      } else cleaned.push(entry);
    }
    setSaving(true);
    try {
      const draft = { title, folderId, blocks: toBlocksRecord(cleaned) };
      const result = await saveLesson({ clubId, lessonId, uid, isDirector, draft, approved, pending });
      // Lo subido aquí que al final no quedó en la lección.
      const used = new Set(lessonFiles(draft));
      await discardUploads(uploaded.filter((p) => !used.has(p)));
      toast.success(result === "published" ? "Lección publicada" : "Enviada a la dirección del club para aprobar");
      router.replace(`/club/lessons/detail?id=${encodeURIComponent(lessonId)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la lección");
      setSaving(false);
    }
  };

  const cancel = async () => {
    await discardUploads(uploaded);
    router.back();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <BackLink href="/club/lessons" label="Lecciones" />
      <h1 className="text-2xl font-bold">{editingId ? "Editar lección" : "Nueva lección"}</h1>
      {!isDirector && (
        <p className="text-sm text-muted-foreground">
          Al guardar, la lección pasa a la dirección del club para que la apruebe.
          {approved ? " Mientras tanto el club sigue viendo la versión publicada." : ""}
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="lesson-title">Título</Label>
        <Input id="lesson-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>Carpeta</Label>
        <Button variant="outline" className="w-full justify-start" onClick={() => setPickFolder(true)}>
          <Folder /> <span className="truncate">{path.length ? path.map((c) => c.name).join(" / ") : "Lecciones (inicio)"}</span>
        </Button>
      </div>

      {blocks.map((entry, i) => {
        const b = entry.block;
        return (
          <Card key={entry.id}>
            <CardContent className="space-y-3 py-3">
              <div className="flex items-center gap-1">
                <span className="flex-1 text-xs font-medium text-muted-foreground">{BLOCK_LABEL[b.type]}</span>
                <Button variant="ghost" size="icon-lg" aria-label="Subir bloque" disabled={i === 0} onClick={() => setBlocks((l) => moveBlock(l, i, -1))}>
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Bajar bloque"
                  disabled={i === blocks.length - 1}
                  onClick={() => setBlocks((l) => moveBlock(l, i, 1))}
                >
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-lg" aria-label="Quitar bloque" onClick={() => remove(entry.id)}>
                  <Trash2 />
                </Button>
              </div>

              {b.type === "text" && (
                <Textarea
                  aria-label="Texto"
                  value={b.text}
                  rows={5}
                  maxLength={20000}
                  onChange={(e) => update(entry.id, { text: e.target.value })}
                />
              )}
              {b.type === "pdf" && <LessonBlockView block={b} />}
              {b.type === "video" && b.source === "link" && (
                <div className="space-y-2">
                  <Input
                    aria-label="Enlace del vídeo"
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={b.url}
                    onChange={(e) => update(entry.id, { url: e.target.value })}
                  />
                  <Input
                    aria-label="Título del vídeo"
                    placeholder="Título (opcional)"
                    value={b.title ?? ""}
                    maxLength={120}
                    onChange={(e) => update(entry.id, { title: e.target.value })}
                  />
                  {normalizeVideoUrl(b.url) && <VideoLinkCard url={b.url} title={b.title} />}
                </div>
              )}
              {b.type === "video" && b.source === "file" && (
                <div className="space-y-2">
                  <LessonBlockView block={{ ...b, title: null }} />
                  <Input
                    aria-label="Título del vídeo"
                    placeholder="Título (opcional)"
                    value={b.title ?? ""}
                    maxLength={120}
                    onChange={(e) => update(entry.id, { title: e.target.value })}
                  />
                </div>
              )}
              {b.type === "board" && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="block w-full overflow-hidden rounded-lg border"
                    aria-label="Editar jugada"
                    onClick={() => setBoard({ id: entry.id, data: b.boardData })}
                  >
                    <BoardSvg objects={parseBoardData(b.boardData).objects} interactive={false} className="block h-auto w-full" />
                  </button>
                  <Input
                    aria-label="Título de la jugada"
                    placeholder="Título (opcional)"
                    value={b.title ?? ""}
                    maxLength={120}
                    onChange={(e) => update(entry.id, { title: e.target.value })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {uploading && (
        <Card>
          <CardContent className="space-y-2 py-3 text-sm">
            <p className="truncate">
              Subiendo {uploading.kind === "pdf" ? "PDF" : "vídeo"}: {uploading.name}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(uploading.progress * 100)}>
              <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(uploading.progress * 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Añadir a la lección</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button variant="outline" size="xl" onClick={() => add({ type: "text", order: 0, text: "" })}>
            <Type /> Texto
          </Button>
          <Button variant="outline" size="xl" disabled={Boolean(uploading)} onClick={() => pdfInput.current?.click()}>
            <FileText /> PDF
          </Button>
          <Button variant="outline" size="xl" onClick={() => add({ type: "video", order: 0, source: "link", url: "", title: null })}>
            <Link2 /> Enlace de vídeo
          </Button>
          <Button variant="outline" size="xl" disabled={Boolean(uploading)} onClick={() => videoInput.current?.click()}>
            <Upload /> Subir vídeo
          </Button>
          <Button variant="outline" size="xl" onClick={() => setBoard({ id: null, data: null })}>
            <PenTool /> Jugada
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">PDF hasta 20 MB · vídeo hasta 200 MB.</p>
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            void onFile("pdf", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            void onFile("video", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-2xl justify-end gap-2">
          <Button variant="outline" size="xl" disabled={saving} onClick={() => void cancel()}>
            Cancelar
          </Button>
          <Button size="xl" disabled={saving || Boolean(uploading)} onClick={() => void save()}>
            {saving ? "Guardando…" : isDirector ? "Publicar" : "Enviar para aprobar"}
          </Button>
        </div>
      </div>

      <FolderPickerDialog
        open={pickFolder}
        onOpenChange={setPickFolder}
        title="Guardar en…"
        folders={folders}
        current={folderId}
        onPick={(id) => setFolderId(id)}
      />
      {board && (
        <WhiteboardDialog
          key={board.id ?? "new"}
          open
          onOpenChange={(open) => !open && setBoard(null)}
          initialBoardData={board.data}
          onSave={({ boardData, previewUrl }) => {
            URL.revokeObjectURL(previewUrl);
            if (board.id) update(board.id, { boardData });
            else add({ type: "board", order: 0, boardData, title: null });
            setBoard(null);
          }}
        />
      )}
    </div>
  );
}

export default function LessonEditPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LessonEditor />
    </Suspense>
  );
}
