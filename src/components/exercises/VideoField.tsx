"use client";

import { Link2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { VideoLinkCard } from "@/components/media/VideoLinkCard";
import { VideoRefView } from "@/components/media/VideoRefView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadExerciseVideo } from "@/lib/actions/exercise-extras";
import { validateExerciseVideo } from "@/lib/exercise-extras";
import { normalizeVideoUrl } from "@/lib/match";
import type { VideoRef } from "@/lib/schemas/exercise-extras";

/**
 * Vídeo opcional del editor de niveles (2026-09-29): enlace o subida a
 * exercise_videos/{uid}/. `onUploaded` avisa de cada fichero subido para que el
 * editor borre los que al final no se guarden; `onBusyChange` bloquea guardar
 * mientras sube.
 */
export function VideoField({
  value,
  onChange,
  onUploaded,
  onBusyChange,
}: {
  value: VideoRef | null;
  onChange: (v: VideoRef | null) => void;
  onUploaded: (path: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const error = validateExerciseVideo(file);
    if (error) {
      toast.error(error);
      return;
    }
    setUploading({ name: file.name, progress: 0 });
    onBusyChange(true);
    try {
      const up = await uploadExerciseVideo(file, (progress) => setUploading((u) => (u ? { ...u, progress } : u)));
      onUploaded(up.path);
      onChange({ source: "file", url: up.url, path: up.path, title: up.title });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el vídeo");
    } finally {
      setUploading(null);
      onBusyChange(false);
    }
  };

  const title = (
    <Input
      aria-label="Título del vídeo"
      placeholder="Título (opcional)"
      value={value?.title ?? ""}
      maxLength={120}
      onChange={(e) => value && onChange({ ...value, title: e.target.value })}
    />
  );
  const remove = (
    <Button type="button" variant="ghost" size="icon-lg" aria-label="Quitar vídeo" onClick={() => onChange(null)}>
      <Trash2 />
    </Button>
  );

  if (uploading) {
    const pct = Math.round(uploading.progress * 100);
    return (
      <div className="space-y-2 text-sm">
        <p className="truncate">Subiendo vídeo: {uploading.name}</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct}>
          <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (value?.source === "link") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Input
            aria-label="Enlace del vídeo"
            placeholder="https://www.youtube.com/watch?v=…"
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
          />
          {remove}
        </div>
        {title}
        {normalizeVideoUrl(value.url) && <VideoLinkCard url={value.url} title={value.title} />}
      </div>
    );
  }
  if (value?.source === "file") {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <VideoRefView video={value} showTitle={false} />
          </div>
          {remove}
        </div>
        {title}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => onChange({ source: "link", url: "", title: null })}>
          <Link2 /> Enlace de vídeo
        </Button>
        <Button type="button" variant="outline" onClick={() => input.current?.click()}>
          <Upload /> Subir vídeo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Vídeo hasta 200 MB.</p>
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
