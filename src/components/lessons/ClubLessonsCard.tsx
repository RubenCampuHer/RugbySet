"use client";

import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useClubLessons, useLessonsClub, usePendingLessons } from "@/hooks/useClubLessons";

/**
 * Entrada a las lecciones del club desde /club (2026-09-28): para cualquier
 * miembro; a la dirección le avisa de lo que espera aprobación.
 */
export function ClubLessonsCard() {
  const { uid, clubId, isDirector, canWrite, loading } = useLessonsClub();
  const { lessons, folders } = useClubLessons(clubId);
  const { pending } = usePendingLessons(clubId, uid, isDirector);
  if (loading || !clubId) return null;

  const count = Object.keys(lessons).length;
  const pendingCount = Object.keys(pending).length;
  const hint =
    count === 0
      ? canWrite
        ? "Crea carpetas y lecciones con texto, PDF, vídeos y jugadas."
        : "Aquí verás la metodología que publique el club."
      : `${count} ${count === 1 ? "lección" : "lecciones"} · ${Object.keys(folders).length} ${
          Object.keys(folders).length === 1 ? "carpeta" : "carpetas"
        }`;

  return (
    <Card>
      <CardContent className="py-1">
        <Link href="/club/lessons" className="flex min-h-14 items-center gap-3 rounded-md px-1 hover:bg-muted/50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="size-5 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Lecciones del club</span>
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
          </span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {pendingCount} {isDirector ? "por aprobar" : pendingCount === 1 ? "pendiente" : "pendientes"}
            </Badge>
          )}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
