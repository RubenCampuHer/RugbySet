"use client";

import { FileText } from "lucide-react";
import { LibraryRefCard } from "@/components/lessons/LibraryRefCard";
import { LinkifiedText } from "@/components/LinkifiedText";
import { VideoLinkCard } from "@/components/media/VideoLinkCard";
import { BoardSvg } from "@/components/whiteboard/BoardSvg";
import { parseBoardData } from "@/components/whiteboard/types";
import { sortedBlocks } from "@/lib/lessons";
import type { Lesson, LessonBlock } from "@/lib/schemas/lesson";

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Un bloque de la lección en solo lectura. */
export function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "text":
      return <LinkifiedText text={block.text} className="text-sm leading-relaxed" />;
    case "pdf":
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{block.name}</span>
            <span className="block text-xs text-muted-foreground">
              PDF{block.size ? ` · ${formatSize(block.size)}` : ""} · Abrir
            </span>
          </span>
        </a>
      );
    case "video":
      if (block.source === "file") {
        return (
          <figure className="space-y-1">
            <video controls preload="metadata" src={block.url} className="w-full rounded-lg bg-black">
              <track kind="captions" />
            </video>
            {block.title && <figcaption className="text-xs text-muted-foreground">{block.title}</figcaption>}
          </figure>
        );
      }
      return <VideoLinkCard url={block.url} title={block.title} />;
    case "exercise":
    case "training":
      return <LibraryRefCard kind={block.type} refName={block.ref} />;
    case "board":
      return (
        <figure className="space-y-1">
          <div className="overflow-hidden rounded-lg border">
            <BoardSvg objects={parseBoardData(block.boardData).objects} interactive={false} className="block h-auto w-full" />
          </div>
          {block.title && <figcaption className="text-xs text-muted-foreground">{block.title}</figcaption>}
        </figure>
      );
  }
}

/** Todos los bloques en orden. */
export function LessonBlocksView({ lesson }: { lesson: Pick<Lesson, "blocks"> }) {
  const blocks = sortedBlocks(lesson);
  if (blocks.length === 0) return <p className="text-sm text-muted-foreground">Esta lección todavía no tiene contenido.</p>;
  return (
    <div className="space-y-4">
      {blocks.map(({ id, block }) => (
        <LessonBlockView key={id} block={block} />
      ))}
    </div>
  );
}
