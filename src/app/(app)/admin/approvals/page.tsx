"use client";

import { Check, CheckCheck, Lock, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useExercises } from "@/hooks/useExercises";
import { useTrainings } from "@/hooks/useTrainings";
import { updateApprovalStatus } from "@/lib/actions/admin";
import { isAdmin } from "@/lib/permissions";

// Espejo de ApprovalQueueFragment: lista contenido PENDING y el ADMIN
// aprueba/rechaza (la regla RTDB valida el rol en servidor).
export default function ApprovalsPage() {
  const { profile } = useAuth();
  const { exercises, loading: loadingEx } = useExercises();
  const { trainings, loading: loadingTr } = useTrainings();
  const [busy, setBusy] = useState<string | null>(null);

  if (profile === null || loadingEx || loadingTr) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para ver la cola de aprobación."
      />
    );
  }

  const pending = [
    ...exercises
      .filter((e) => e.approvalStatus === "PENDING")
      .map((e) => ({ kind: "exercise" as const, name: e.name!, author: e.author, desc: e.descCorta })),
    ...trainings
      .filter((t) => t.approvalStatus === "PENDING")
      .map((t) => ({ kind: "training" as const, name: t.name!, author: t.author, desc: t.descCorta })),
  ];

  const decide = async (
    kind: "exercise" | "training",
    name: string,
    status: "APPROVED" | "REJECTED",
  ) => {
    setBusy(name);
    try {
      await updateApprovalStatus(kind, name, status);
      toast.success(`"${name}" ${status === "APPROVED" ? "aprobado" : "rechazado"}`);
    } catch {
      toast.error("No se pudo actualizar (¿eres ADMIN?)");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Cola de aprobación" count={pending.length || undefined} />

      {pending.length === 0 ? (
        <EmptyState icon={CheckCheck} title="Todo revisado" hint="No hay contenido pendiente de aprobación." />
      ) : (
        <div className="space-y-2">
          {pending.map((item) => (
            <Card key={`${item.kind}-${item.name}`}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/${item.kind === "exercise" ? "exercises" : "trainings"}/detail?name=${encodeURIComponent(item.name)}`}
                    className="font-medium text-brand underline-offset-4 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.kind === "exercise" ? "Ejercicio" : "Entreno"}
                    {item.author && ` · de ${item.author}`}
                    {item.desc && ` — ${item.desc}`}
                  </p>
                </div>
                <span className="flex shrink-0 gap-1">
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon-xl"
                        aria-label={`Aprobar ${item.name}`}
                        disabled={busy === item.name}
                        className="rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
                      >
                        <Check className="size-4" />
                      </Button>
                    }
                    title={`¿Aprobar "${item.name}"?`}
                    confirmLabel="Aprobar"
                    onConfirm={() => decide(item.kind, item.name, "APPROVED")}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon-xl"
                        variant="destructive"
                        aria-label={`Rechazar ${item.name}`}
                        disabled={busy === item.name}
                        className="rounded-full"
                      >
                        <X className="size-4" />
                      </Button>
                    }
                    title={`¿Rechazar "${item.name}"?`}
                    confirmLabel="Rechazar"
                    destructive
                    onConfirm={() => decide(item.kind, item.name, "REJECTED")}
                  />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
