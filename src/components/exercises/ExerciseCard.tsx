"use client";

import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gradientFor } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/types";

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const name = exercise.name ?? "(sin nombre)";
  return (
    <Link href={`/exercises/detail?name=${encodeURIComponent(name)}`}>
      <Card className="h-full overflow-hidden transition-all hover:border-border/80 hover:bg-muted/50 active:scale-[0.98]">
        {exercise.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export)
          <img
            src={exercise.image}
            alt=""
            className="h-36 w-full rounded-t-xl object-cover"
            loading="lazy"
          />
        ) : (
          // Gradiente de marca (como los cards de la app Android) cuando no hay imagen
          <div
            className={cn(
              "flex h-36 w-full items-center justify-center rounded-t-xl bg-gradient-to-br",
              gradientFor(name),
            )}
          >
            <Dumbbell className="size-10 text-white/40" />
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
            <PrivacyBadge privacy={exercise.privacy} />
            <ApprovalBadge status={exercise.approvalStatus} />
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
