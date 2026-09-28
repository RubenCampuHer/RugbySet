"use client";

import { BookOpen, ChevronRight, Folder, FolderPlus, Lock, MoreVertical, Pencil, Plus, Trash2, FolderInput } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/BackLink";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { AudienceBadge } from "@/components/audience/AudiencePicker";
import { FolderDialog, FolderPickerDialog } from "@/components/lessons/LessonDialogs";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClubLessons, useLessonsClub, usePendingLessons } from "@/hooks/useClubLessons";
import { createFolder, deleteFolder, deleteLesson, type LessonsCtx, moveFolder, moveLesson, updateFolder } from "@/lib/actions/lessons";
import {
  breadcrumb,
  canMoveFolder,
  childFolders,
  descendantIds,
  isFolderEmpty,
  lessonsIn,
  parentAudience,
  type Lessons,
} from "@/lib/lessons";
import { canEditClubItem } from "@/lib/permissions";
import type { Lesson } from "@/lib/schemas/lesson";

type Dialog =
  | { kind: "newFolder" }
  | { kind: "edit"; id: string }
  | { kind: "moveFolder"; id: string; parentId: string | null }
  | { kind: "moveLesson"; id: string; folderId: string | null }
  | { kind: "deleteFolder"; id: string; name: string }
  | { kind: "deleteLesson"; id: string; title: string };

const folderHref = (id: string | null) => (id ? `/club/lessons?folder=${encodeURIComponent(id)}` : "/club/lessons");
const lessonHref = (id: string) => `/club/lessons/detail?id=${encodeURIComponent(id)}`;

function RowMenu({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label={label} />}>
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Lecciones del club (2026-09-28): carpetas y subcarpetas con lecciones. Las
 * ven todos los miembros; crean la dirección y los entrenadores del club, y
 * lo de un entrenador espera la aprobación de la dirección.
 */
function ClubLessons() {
  const params = useSearchParams();
  const requested = params.get("folder");
  const { uid, clubId, club, isDirector, canWrite, loading } = useLessonsClub();
  const { folders, lessons, loading: loadingLessons, error } = useClubLessons(clubId);
  const { pending, loading: loadingPending } = usePendingLessons(clubId, uid, isDirector);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = (open: boolean) => !open && setDialog(null);

  if (loading || loadingLessons || loadingPending) return <ListRowsSkeleton />;
  if (!clubId) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Tu equipo no es de ningún club"
        hint="Las lecciones son del club: las verás cuando tu equipo forme parte de uno."
        action={
          <Link href="/club" className={buttonVariants({ variant: "outline" })}>
            Ir a Club
          </Link>
        }
      />
    );
  }
  if (error) {
    return <EmptyState icon={Lock} title="No puedes ver las lecciones de este club" hint="Solo los miembros del club las ven." />;
  }

  const folderId = requested && folders[requested] ? requested : null;
  const path = breadcrumb(folders, folderId);
  const current = folderId ? folders[folderId] : null;
  const subfolders = childFolders(folders, folderId);

  // Publicadas + pendientes que puedo ver; una pendiente de una publicada marca "Cambios pendientes".
  const pendingOnly: Lessons = Object.fromEntries(Object.entries(pending).filter(([id]) => !lessons[id]));
  const rows = lessonsIn({ ...lessons, ...pendingOnly }, folders, folderId);
  const itemsIn = (id: string) =>
    childFolders(folders, id).length + lessonsIn({ ...lessons, ...pendingOnly }, folders, id).length;

  const guard = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      throw e;
    }
  };

  const ctx: LessonsCtx = { folders, lessons, pending, uid: uid!, isDirector };
  const clubTeams = club?.teams ?? [];
  const editing = dialog?.kind === "edit" ? folders[dialog.id] : null;

  const lessonOf = (id: string): { approved: Lesson | null; pending: Lesson | null } => ({
    approved: lessons[id] ?? null,
    pending: pending[id] ?? null,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink
        href={path.length > 1 ? folderHref(path[path.length - 2].id) : folderId ? folderHref(null) : "/club"}
        label={path.length > 1 ? path[path.length - 2].name : folderId ? "Lecciones" : "Club"}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{current?.name ?? "Lecciones"}</h1>
          <nav aria-label="Ruta" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link href={folderHref(null)} className="hover:underline">
              {club?.clubname ?? "Club"}
            </Link>
            {path.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                {c.id === folderId ? (
                  <span className="text-foreground">{c.name}</span>
                ) : (
                  <Link href={folderHref(c.id)} className="hover:underline">
                    {c.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
        {canWrite && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="icon-lg" aria-label="Nueva carpeta" onClick={() => setDialog({ kind: "newFolder" })}>
              <FolderPlus />
            </Button>
            <Link
              href={`/club/lessons/edit${folderId ? `?folder=${encodeURIComponent(folderId)}` : ""}`}
              className={buttonVariants({ size: "icon-lg" })}
              aria-label="Nueva lección"
            >
              <Plus />
            </Link>
          </div>
        )}
      </div>

      {isDirector && !folderId && Object.keys(pending).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendientes de aprobar ({Object.keys(pending).length})</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {Object.entries(pending).map(([id, l]) => (
              <Link key={id} href={lessonHref(id)} className="flex min-h-11 items-center gap-2 py-2 text-sm hover:underline">
                <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                <Badge variant="secondary">{lessons[id] ? "Cambios" : "Nueva"}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {subfolders.length === 0 && rows.length === 0 ? (
        <EmptyState
          icon={Folder}
          title={folderId ? "Carpeta vacía" : "Todavía no hay lecciones"}
          hint={
            canWrite
              ? "Crea carpetas para ordenar la metodología del club y añade lecciones con texto, PDF, vídeos y jugadas."
              : "Cuando la dirección o los entrenadores del club publiquen lecciones, aparecerán aquí."
          }
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border py-1">
            {subfolders.map(({ id, folder }) => {
              const editable = canEditClubItem(folder, uid, isDirector, canWrite);
              const empty = isFolderEmpty(folders, [lessons, pending], id);
              const count = itemsIn(id);
              return (
                <div key={id} className="flex items-center gap-2 py-1">
                  <Link href={folderHref(id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-1 hover:bg-muted/50">
                    <Folder className="size-5 shrink-0 fill-muted text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
                    <AudienceBadge audience={folder.audience} />
                    <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
                  </Link>
                  {editable && (
                    <RowMenu label={`Opciones de la carpeta ${folder.name}`}>
                      <DropdownMenuItem onClick={() => setDialog({ kind: "edit", id })}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ kind: "moveFolder", id, parentId: folder.parentId ?? null })}>
                        <FolderInput /> Mover
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={!empty}
                        onClick={() => setDialog({ kind: "deleteFolder", id, name: folder.name })}
                      >
                        <Trash2 /> {empty ? "Borrar" : "Borrar (vacíala antes)"}
                      </DropdownMenuItem>
                    </RowMenu>
                  )}
                </div>
              );
            })}
            {rows.map(({ id, lesson }) => {
              const both = lessonOf(id);
              const editable = canEditClubItem(lesson, uid, isDirector, canWrite);
              return (
                <div key={id} className="flex items-center gap-2 py-1">
                  <Link href={lessonHref(id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-1 hover:bg-muted/50">
                    <BookOpen className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{lesson.title}</span>
                    <AudienceBadge audience={lesson.audience} />
                    {both.pending && (
                      <Badge variant="secondary" className="shrink-0">
                        {both.approved ? "Cambios pendientes" : "Pendiente"}
                      </Badge>
                    )}
                  </Link>
                  {editable && (
                    <RowMenu label={`Opciones de la lección ${lesson.title}`}>
                      <DropdownMenuItem render={<Link href={`/club/lessons/edit?id=${encodeURIComponent(id)}`} />}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      {isDirector && both.approved && (
                        <DropdownMenuItem onClick={() => setDialog({ kind: "moveLesson", id, folderId: lesson.folderId ?? null })}>
                          <FolderInput /> Mover
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDialog({ kind: "deleteLesson", id, title: lesson.title })}>
                        <Trash2 /> Borrar
                      </DropdownMenuItem>
                    </RowMenu>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <FolderDialog
        open={dialog?.kind === "newFolder"}
        onOpenChange={close}
        title={folderId ? `Nueva carpeta en ${current?.name}` : "Nueva carpeta"}
        inherited={parentAudience(folders, folderId)}
        teams={clubTeams}
        submitLabel="Crear"
        onSubmit={(name, own) => guard(async () => void (await createFolder(clubId, ctx, name, folderId, own)), "Carpeta creada")}
      />
      <FolderDialog
        open={dialog?.kind === "edit"}
        onOpenChange={close}
        title="Editar carpeta"
        initialName={editing?.name ?? ""}
        initialAudience={editing && editing.audienceInherited === false ? (editing.audience ?? null) : null}
        inherited={parentAudience(folders, editing?.parentId)}
        teams={clubTeams}
        submitLabel="Guardar"
        onSubmit={(name, own) =>
          guard(() => updateFolder(clubId, ctx, (dialog as { id: string }).id, { name, ownAudience: own }), "Carpeta guardada")
        }
      />
      <FolderPickerDialog
        open={dialog?.kind === "moveFolder"}
        onOpenChange={close}
        title="Mover carpeta a…"
        folders={folders}
        current={dialog?.kind === "moveFolder" ? dialog.parentId : null}
        disabled={(target) =>
          dialog?.kind === "moveFolder" &&
          (target === dialog.id || descendantIds(folders, dialog.id).has(target) || !canMoveFolder(folders, dialog.id, target))
        }
        onPick={(target) => guard(() => moveFolder(clubId, ctx, (dialog as { id: string }).id, target), "Carpeta movida")}
      />
      <FolderPickerDialog
        open={dialog?.kind === "moveLesson"}
        onOpenChange={close}
        title="Mover lección a…"
        folders={folders}
        current={dialog?.kind === "moveLesson" ? dialog.folderId : null}
        onPick={(target) => guard(() => moveLesson(clubId, ctx, (dialog as { id: string }).id, target), "Lección movida")}
      />
      <ConfirmDialog
        open={dialog?.kind === "deleteFolder"}
        onOpenChange={close}
        title={`¿Borrar la carpeta ${dialog?.kind === "deleteFolder" ? dialog.name : ""}?`}
        confirmLabel="Borrar"
        destructive
        onConfirm={() => guard(() => deleteFolder(clubId, (dialog as { id: string }).id), "Carpeta borrada")}
      />
      <ConfirmDialog
        open={dialog?.kind === "deleteLesson"}
        onOpenChange={close}
        title={`¿Borrar la lección ${dialog?.kind === "deleteLesson" ? dialog.title : ""}?`}
        description="Se borra para todo el club, con sus PDFs y vídeos subidos."
        confirmLabel="Borrar"
        destructive
        onConfirm={() => {
          const id = (dialog as { id: string }).id;
          const { approved, pending: p } = lessonOf(id);
          return guard(() => deleteLesson(clubId, id, approved, p), "Lección borrada");
        }}
      />
    </div>
  );
}

export default function ClubLessonsPage() {
  return (
    <Suspense fallback={<ListRowsSkeleton />}>
      <ClubLessons />
    </Suspense>
  );
}
