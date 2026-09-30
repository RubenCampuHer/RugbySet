"use client";

import { FileText, Lock, Pencil } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { LessonBlocksView } from "@/components/lessons/LessonBlocksView";
import { DetailSkeleton } from "@/components/skeletons";
import { StaffBadge } from "@/components/team-docs/TeamDocsUi";
import { buttonVariants } from "@/components/ui/button";
import { useTeamDocs, useTeamDocsAccess } from "@/hooks/useTeamDocs";
import { breadcrumbOf, teamDocsHref } from "@/lib/team-docs";

/** Documento del equipo en solo lectura (2026-09-30). */
function TeamDocView() {
  const params = useSearchParams();
  const teamParam = params.get("team");
  const id = params.get("id");
  const access = useTeamDocsAccess(teamParam);
  const teamname = access.team?.teamname ?? null;
  const { docs: m, loading } = useTeamDocs(teamname, access.canRead, access.canSeeStaff);

  if (access.loading || (access.canRead && loading)) return <DetailSkeleton />;
  if (!access.canRead) {
    return <EmptyState icon={Lock} title="Solo el equipo" hint="Este documento es de un equipo del que no formas parte." />;
  }
  const found = id ? m.docs[id] : undefined;
  if (!found) {
    return (
      <EmptyState
        icon={FileText}
        title="Documento no encontrado"
        hint="Puede que lo hayan borrado o que ya solo lo vea el cuerpo técnico."
        action={
          <Link href={teamDocsHref(teamParam, null)} className={buttonVariants({ variant: "outline" })}>
            Ir a Documentos
          </Link>
        }
      />
    );
  }
  const { item: doc, space } = found;
  const folder = doc.folderId && m.folders[doc.folderId] ? doc.folderId : null;
  const path = breadcrumbOf(m, folder);
  const q = new URLSearchParams({ ...(teamParam ? { team: teamParam } : {}), id: id! }).toString();

  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <BackLink href={teamDocsHref(teamParam, folder)} label={path.length ? path[path.length - 1].name : "Documentos"} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StaffBadge space={space} />
            {doc.updatedAt > 0 && (
              <span>
                Actualizado el{" "}
                {new Date(doc.updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        {access.canEdit && (
          <Link href={`/team/docs/edit?${q}`} className={buttonVariants({ variant: "outline", size: "icon-lg" })} aria-label="Editar documento">
            <Pencil />
          </Link>
        )}
      </div>
      {Object.values(doc.blocks).some(Boolean) ? (
        <LessonBlocksView lesson={doc} />
      ) : (
        <p className="text-sm text-muted-foreground">Documento vacío.</p>
      )}
    </article>
  );
}

export default function TeamDocViewPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <TeamDocView />
    </Suspense>
  );
}
