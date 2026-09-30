"use client";

import { ArrowDown, ArrowUp, ClipboardList, Dumbbell, FileText, Link2, PenTool, Trash2, Type, Upload } from "lucide-react";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import { toast } from "sonner";
import { TrainingPickerSheet } from "@/components/calendar/TrainingPickerSheet";
import { LessonBlockView } from "@/components/lessons/LessonBlocksView";
import { LibraryRefCard } from "@/components/lessons/LibraryRefCard";
import { VideoLinkCard } from "@/components/media/VideoLinkCard";
import { ExercisePickerSheet } from "@/components/trainings/ExercisePickerSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BoardSvg } from "@/components/whiteboard/BoardSvg";
import { parseBoardData } from "@/components/whiteboard/types";
import { WhiteboardDialog } from "@/components/whiteboard/WhiteboardDialog";
import { moveBlock, validateLessonFile, type BlockEntry } from "@/lib/lessons";
import { normalizeVideoUrl } from "@/lib/match";
import type { LessonBlock } from "@/lib/schemas/lesson";

let localSeq = 0;
/** Id local de bloque (clave RTDB válida, sin push para no depender de la red). */
export const blockId = () => `b${Date.now().toString(36)}${(localSeq++).toString(36)}`;

const BLOCK_LABEL: Record<LessonBlock["type"], string> = {
  text: "Texto",
  pdf: "PDF",
  video: "Vídeo",
  board: "Jugada",
  exercise: "Ejercicio",
  training: "Entreno",
};

export type UploadedBlockFile = { url: string; path: string; name: string; size: number };
type UploadState = { kind: "pdf" | "video"; name: string; progress: number };

/**
 * Editor de bloques (texto, PDF, vídeo, jugada, ejercicio, entreno), sacado de
 * las lecciones del club (2026-09-30) para reutilizarlo en los documentos del
 * equipo. Quien lo usa decide dónde se suben los ficheros (`upload`) y guarda
 * la lista de subidos (`onUploaded`) para borrar los que al final no se usen.
 */
export function BlocksEditor({
  blocks,
  setBlocks,
  upload,
  onUploaded,
  onBusyChange,
  addLabel,
  showPrivacyHint = false,
}: {
  blocks: BlockEntry[];
  setBlocks: Dispatch<SetStateAction<BlockEntry[]>>;
  upload: (kind: "pdf" | "video", file: File, onProgress: (fraction: number) => void) => Promise<UploadedBlockFile>;
  onUploaded: (path: string) => void;
  onBusyChange?: (busy: boolean) => void;
  addLabel: string;
  showPrivacyHint?: boolean;
}) {
  const [uploading, setUploading] = useState<UploadState | null>(null);
  const [board, setBoard] = useState<{ id: string | null; data: string | null } | null>(null);
  const [pickExercises, setPickExercises] = useState(false);
  const [exerciseSelection, setExerciseSelection] = useState<Set<string>>(new Set());
  const [pickTraining, setPickTraining] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const update = (id: string, patch: Partial<LessonBlock>) =>
    setBlocks((list) => list.map((e) => (e.id === id ? { ...e, block: { ...e.block, ...patch } as LessonBlock } : e)));
  const add = (block: LessonBlock) => setBlocks((list) => [...list, { id: blockId(), block }]);
  const remove = (id: string) => setBlocks((list) => list.filter((e) => e.id !== id));

  const onFile = async (kind: "pdf" | "video", file: File | undefined) => {
    if (!file) return;
    const error = validateLessonFile(kind, file);
    if (error) {
      toast.error(error);
      return;
    }
    setUploading({ kind, name: file.name, progress: 0 });
    onBusyChange?.(true);
    try {
      const up = await upload(kind, file, (progress) => setUploading((u) => (u ? { ...u, progress } : u)));
      onUploaded(up.path);
      add(
        kind === "pdf"
          ? { type: "pdf", order: 0, url: up.url, path: up.path, name: up.name, size: up.size }
          : { type: "video", order: 0, source: "file", url: up.url, path: up.path, title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el fichero");
    } finally {
      setUploading(null);
      onBusyChange?.(false);
    }
  };

  return (
    <>
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
              {(b.type === "exercise" || b.type === "training") && (
                <LibraryRefCard kind={b.type} refName={b.ref} showPrivacyHint={showPrivacyHint} />
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
        <p className="text-xs font-medium text-muted-foreground">{addLabel}</p>
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
          <Button
            variant="outline"
            size="xl"
            onClick={() => {
              setExerciseSelection(new Set());
              setPickExercises(true);
            }}
          >
            <Dumbbell /> Ejercicio
          </Button>
          <Button variant="outline" size="xl" onClick={() => setPickTraining(true)}>
            <ClipboardList /> Entreno
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

      <ExercisePickerSheet
        open={pickExercises}
        onOpenChange={setPickExercises}
        selection={exerciseSelection}
        confirmLabel={addLabel}
        onToggle={(name) =>
          setExerciseSelection((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
          })
        }
        onConfirm={() => {
          for (const ref of exerciseSelection) add({ type: "exercise", order: 0, ref });
          setPickExercises(false);
        }}
      />
      <TrainingPickerSheet
        open={pickTraining}
        onOpenChange={setPickTraining}
        value=""
        onConfirm={(ref) => {
          if (ref) add({ type: "training", order: 0, ref });
          setPickTraining(false);
        }}
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
    </>
  );
}
