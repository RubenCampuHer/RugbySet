"use client";

import { Layers } from "lucide-react";
import { LibraryRefCard } from "@/components/lessons/LibraryRefCard";
import { LinkifiedText } from "@/components/LinkifiedText";
import { VideoRefView } from "@/components/media/VideoRefView";
import { Card, CardContent } from "@/components/ui/card";
import { sortedLevels } from "@/lib/exercise-extras";
import type { ExerciseExtras } from "@/lib/schemas/exercise-extras";

/** Vídeo del ejercicio y sus niveles, en orden (2026-09-29). */
export function ExerciseExtrasView({ extras }: { extras: ExerciseExtras }) {
  const levels = sortedLevels(extras);
  return (
    <div className="space-y-4">
      {extras.video && <VideoRefView video={extras.video} />}
      {levels.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Layers className="size-5" /> Niveles
          </h2>
          <ol className="space-y-2">
            {levels.map(({ id, level }, i) => (
              <li key={id} className="break-inside-avoid">
                <Card>
                  <CardContent className="space-y-2 py-3">
                    <p className="font-medium">
                      <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs">
                        {i + 1}
                      </span>
                      {level.name}
                    </p>
                    {level.desc && <LinkifiedText text={level.desc} className="text-sm text-muted-foreground" />}
                    {level.ref && <LibraryRefCard kind="exercise" refName={level.ref} />}
                    {level.video && <VideoRefView video={level.video} />}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
