"use client";

import { Link2, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { videoSiteLabel, youtubeId } from "@/lib/match";

/**
 * Enlace a un vídeo con miniatura si es de YouTube (2026-09-28, sacado de
 * MatchResult para reutilizarlo en las lecciones del club).
 */
export function VideoLinkCard({
  url,
  title,
  onRemove,
}: {
  url: string;
  title?: string | null;
  onRemove?: () => void;
}) {
  const yt = youtubeId(url);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border p-1.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
      >
        {yt ? (
          <span className="relative shrink-0 overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
            <img
              src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`}
              alt=""
              className="h-12 w-20 object-cover"
              loading="lazy"
            />
            <Play className="absolute inset-0 m-auto size-5 fill-white text-white drop-shadow" />
          </span>
        ) : (
          <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-muted">
            <Link2 className="size-5 text-muted-foreground" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title || videoSiteLabel(url)}</span>
          {title && <span className="block truncate text-xs text-muted-foreground">{videoSiteLabel(url)}</span>}
        </span>
      </a>
      {onRemove && (
        <Button type="button" size="icon" variant="ghost" aria-label="Quitar vídeo" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
