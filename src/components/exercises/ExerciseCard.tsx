"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Exercise } from "@/lib/types";

const PRIVACY_LABEL: Record<string, string> = {
  Publico: "Público",
  Privado: "Privado",
  Equipo: "Equipo",
};

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const name = exercise.name ?? "(sin nombre)";
  return (
    <Link href={`/exercises/detail?name=${encodeURIComponent(name)}`}>
      <Card className="h-full transition-colors hover:bg-muted/50">
        {exercise.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export)
          <img
            src={exercise.image}
            alt=""
            className="h-36 w-full rounded-t-xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-36 w-full items-center justify-center rounded-t-xl bg-muted text-4xl">
            🏉
          </div>
        )}
        <CardHeader>
          <CardTitle className="line-clamp-1 text-base">{name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {exercise.descCorta && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {exercise.descCorta}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {exercise.privacy && (
              <Badge variant="outline">
                {PRIVACY_LABEL[exercise.privacy] ?? exercise.privacy}
              </Badge>
            )}
            {exercise.etiquetas.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
