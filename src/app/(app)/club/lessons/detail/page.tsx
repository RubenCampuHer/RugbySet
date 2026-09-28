"use client";

import { BookOpen, Check, Clock, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/BackLink";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { LessonBlocksView } from "@/components/lessons/LessonBlocksView";
import { DetailSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClubLessons, useLessonsClub, usePendingLessons } from "@/hooks/useClubLessons";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { approveLesson, rejectLesson } from "@/lib/actions/lessons";
import { breadcrumb } from "@/lib/lessons";
import { canEditClubItem } from "@/lib/permissions";

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

function LessonDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const { uid, clubId, isDirector, canWrite, loading } = useLessonsClub();
  const { folders, lessons, loading: loadingLessons } = useClubLessons(clubId);
  const { pending: pendingMap, loading: loadingPending } = usePendingLessons(clubId, uid, isDirector);
  const approved = lessons[id] ?? null;
  const pending = pendingMap[id] ?? null;
  const [view, setView] = useState<"pending" | "approved">("pending");
  const author = (pending ?? approved)?.createdBy;
  const profiles = useProfilesByUid(author ? [author] : []);

  if (loading || loadingLessons || loadingPending) return <DetailSkeleton />;
  const shown = pending && (view === "pending" || !approved) ? pending : approved;
  if (!clubId || !shown) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Lección no encontrada"
        hint="Puede que la hayan borrado o que todavía no esté aprobada."
        action={
          <Link href="/club/lessons" className={buttonVariants({ variant: "outline" })}>
            Ir a las lecciones
          </Link>
        }
      />
    );
  }

  const showingPending = shown === pending;
  const path = breadcrumb(folders, shown.folderId ?? null);
  const parent = path[path.length - 1];
  const editable = canEditClubItem(shown, uid, isDirector, canWrite);
  const authorName = author ? profiles[author]?.nameSurname : null;

  const approve = async () => {
    try {
      await approveLesson(clubId, id, pending!, approved);
      toast.success("Lección aprobada: ya la ve todo el club");
      setView("approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aprobar");
    }
  };
  const reject = async () => {
    try {
      await rejectLesson(clubId, id, pending!, approved);
      toast.success(approved ? "Cambios descartados" : "Lección rechazada");
      if (!approved) router.push(parent ? `/club/lessons?folder=${encodeURIComponent(parent.id)}` : "/club/lessons");
      else setView("approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo rechazar");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink
        href={parent ? `/club/lessons?folder=${encodeURIComponent(parent.id)}` : "/club/lessons"}
        label={parent?.name ?? "Lecciones"}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{shown.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {authorName ? `${authorName} · ` : ""}
            {shown.updatedAt ? `actualizada el ${dateFmt.format(new Date(shown.updatedAt))}` : ""}
          </p>
        </div>
        {editable && (
          <Link
            href={`/club/lessons/edit?id=${encodeURIComponent(id)}`}
            className={buttonVariants({ variant: "outline", size: "icon-lg" })}
            aria-label="Editar lección"
          >
            <Pencil />
          </Link>
        )}
      </div>

      {pending && approved && (
        <Tabs value={showingPending ? "pending" : "approved"} onValueChange={(v) => setView(v as "pending" | "approved")}>
          <TabsList>
            <TabsTrigger value="pending">Cambios pendientes</TabsTrigger>
            <TabsTrigger value="approved">Publicada</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {showingPending && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <Clock className="size-4 shrink-0 text-warning" />
            <span className="min-w-0 flex-1">
              {isDirector
                ? approved
                  ? "Hay cambios esperando tu aprobación. El club sigue viendo la versión publicada."
                  : "Esta lección espera tu aprobación. Hasta entonces solo la veis su autor y la dirección."
                : "Pendiente de que la dirección del club la apruebe."}
            </span>
            {isDirector && (
              <span className="flex gap-2">
                <ConfirmDialog
                  trigger={
                    <Button variant="outline">
                      <X /> Rechazar
                    </Button>
                  }
                  title={approved ? "¿Descartar estos cambios?" : "¿Rechazar la lección?"}
                  description={approved ? "Se queda la versión publicada." : "Se borra la lección pendiente y sus ficheros."}
                  confirmLabel={approved ? "Descartar" : "Rechazar"}
                  destructive
                  onConfirm={reject}
                />
                <Button onClick={() => void approve()}>
                  <Check /> Aprobar
                </Button>
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <LessonBlocksView lesson={shown} />
    </div>
  );
}

export default function LessonDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LessonDetail />
    </Suspense>
  );
}
