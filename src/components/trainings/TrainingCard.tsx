"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { CardActionsMenu } from "@/components/CardActionsMenu";
import { ApprovalBadge, PrivacyBadge } from "@/components/PrivacyBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteTraining, duplicateTraining } from "@/lib/actions/trainings";
import { gradientFor } from "@/lib/brand";
import { canDeleteTraining, canEditTraining } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Training } from "@/lib/types";

/** Card de entreno para las listas — espejo de ExerciseCard. */
export function TrainingCard({ training }: { training: Training }) {
  const name = training.name ?? "(sin nombre)";
  const { profile } = useAuth();
  const canManage = canEditTraining(profile, training) || canDeleteTraining(profile, training);
  const exerciseCount = training.sections.reduce(
    (sum, s) => sum + s.exercises.length,
    0,
  );
  return (
    <Card className="relative h-full overflow-hidden transition-all hover:border-border/80 hover:bg-muted/50 active:scale-[0.98]">
      <Link
        href={`/trainings/detail?name=${encodeURIComponent(name)}`}
        className="absolute inset-0 z-0"
        aria-label={name}
      />
      {/* Franja lateral con gradiente de marca (paleta de cards Android) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b",
          gradientFor(name),
        )}
      />
      <div className="pointer-events-none">
        <CardHeader>
          <CardTitle className="line-clamp-1 text-base">{name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {training.descCorta && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {training.descCorta}
            </p>
          )}
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {training.tiempoTotal ?? "?"} min · {training.sections.length}{" "}
            secciones · {exerciseCount} ejercicios
          </p>
          <div className="flex flex-wrap gap-1">
            <PrivacyBadge privacy={training.privacy} />
            <ApprovalBadge status={training.approvalStatus} />
            {training.etiquetas.slice(0, 3).map((tag) => (
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
          editHref={`/trainings/edit?name=${encodeURIComponent(name)}`}
          onDuplicate={async () => {
            const newName = await duplicateTraining(training, profile!);
            toast.success(`Duplicado como "${newName}"`);
          }}
          onDelete={async () => {
            await deleteTraining(training, profile!);
            toast.success(`"${name}" eliminado`);
          }}
          deleteTitle="¿Eliminar entreno?"
          deleteDescription={`Se eliminará "${name}" permanentemente.`}
        />
      )}
    </Card>
  );
}
