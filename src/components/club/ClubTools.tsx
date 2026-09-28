"use client";

import { BookOpen, CalendarDays, ChartNoAxesColumn, Megaphone, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useClubLessons, useLessonsClub, usePendingLessons } from "@/hooks/useClubLessons";

function Tile({
  href,
  icon: Icon,
  title,
  hint,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  badge?: string | null;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-24 flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand">
          <Icon className="size-5" />
        </span>
        {badge && (
          <Badge variant="secondary" className="shrink-0">
            {badge}
          </Badge>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">{title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}

/**
 * Herramientas del club en rejilla (2026-09-28, rediseño de /club): cada rol
 * ve las suyas. Lecciones: todo el club; números: dirección y entrenadores;
 * calendario y avisos: dirección.
 */
export function ClubTools() {
  const { uid, clubId, isDirector, canWrite, loading } = useLessonsClub();
  const { lessons } = useClubLessons(clubId);
  const { pending } = usePendingLessons(clubId, uid, isDirector);
  if (loading || !clubId) return null;

  const lessonCount = Object.keys(lessons).length;
  const pendingCount = Object.keys(pending).length;
  const lessonBadge = pendingCount > 0 ? (isDirector ? `${pendingCount} por aprobar` : `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`) : null;

  return (
    <section aria-label="Herramientas del club" className="grid grid-cols-2 gap-2">
      <Tile
        href="/club/lessons"
        icon={BookOpen}
        title="Lecciones"
        hint={lessonCount ? `${lessonCount} ${lessonCount === 1 ? "lección" : "lecciones"} del club` : canWrite ? "Crea la metodología del club" : "La metodología del club"}
        badge={lessonBadge}
      />
      {(isDirector || canWrite) && (
        <Tile href="/club/stats" icon={ChartNoAxesColumn} title="En números" hint="Asistencia y sesiones por equipo" />
      )}
      {isDirector && <Tile href="/club/calendar" icon={CalendarDays} title="Calendario" hint="Todos los equipos y eventos del club" />}
      {isDirector && <Tile href="/club/notify" icon={Megaphone} title="Avisos" hint="Escribe a todo el club o a equipos" />}
    </section>
  );
}
