"use client";

import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { CardActionsMenu } from "@/components/CardActionsMenu";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteExercise, duplicateExercise } from "@/lib/actions/exercises";
import { gradientFor } from "@/lib/brand";
import { canDeleteExercise, canEditExercise } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/types";

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const name = exercise.name ?? "(sin nombre)";
  const { profile } = useAuth();
  const canManage = canEditExercise(profile, exercise) || canDeleteExercise(profile, exercise);

  return (
    <Card className="relative h-full overflow-hidden pt-0 transition-all hover:border-border/80 hover:bg-muted/50 active:scale-[0.98]">
      <Link
        href={`/exercises/detail?name=${encodeURIComponent(name)}`}
        className="absolute inset-0 z-0"
        aria-label={name}
      />
      <div className="pointer-events-none">
        {exercise.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export)
          <img
            src={exercise.image}
            alt=""
            className="aspect-video w-full rounded-t-xl object-cover"
            loading="lazy"
          />
        ) : (
          // Gradiente de marca (como los cards de la app Android) cuando no hay imagen
          <div
            className={cn(
              "flex aspect-video w-full items-center justify-center rounded-t-xl bg-gradient-to-br",
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
      </div>
      {canManage && (
        <CardActionsMenu
          className="absolute top-2 right-2 z-10"
          editHref={`/exercises/edit?name=${encodeURIComponent(name)}`}
          onDuplicate={async () => {
            const newName = await duplicateExercise(exercise, profile!);
            toast.success(`Duplicado como "${newName}"`);
          }}
          onDelete={async () => {
            await deleteExercise(exercise, profile!);
            toast.success(`"${name}" eliminado`);
          }}
          deleteTitle="¿Eliminar ejercicio?"
          deleteDescription={`Se eliminará "${name}" permanentemente.`}
        />
      )}
    </Card>
  );
}
