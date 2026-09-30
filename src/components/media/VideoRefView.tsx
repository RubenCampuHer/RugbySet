"use client";

import { VideoLinkCard } from "@/components/media/VideoLinkCard";
import type { VideoRef } from "@/lib/schemas/exercise-extras";

/** Vídeo subido (reproductor) o enlace (tarjeta con miniatura si es YouTube). */
export function VideoRefView({ video, showTitle = true }: { video: VideoRef; showTitle?: boolean }) {
  if (video.source === "file") {
    return (
      <figure className="space-y-1">
        <video controls preload="metadata" src={video.url} className="w-full rounded-lg bg-black">
          <track kind="captions" />
        </video>
        {showTitle && video.title && <figcaption className="text-xs text-muted-foreground">{video.title}</figcaption>}
      </figure>
    );
  }
  return <VideoLinkCard url={video.url} title={video.title} />;
}
