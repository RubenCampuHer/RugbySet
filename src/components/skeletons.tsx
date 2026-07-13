import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Lista de cards (ejercicios/entrenos): título + tabs + buscador + grid. */
export function ListSkeleton({ columns = 3 }: { columns?: 2 | 3 }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-9 w-full" />
      <div
        className={cn(
          "grid grid-cols-2 gap-4",
          columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        )}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Detalle de ejercicio/entreno: back-link + título + badges + cuerpo. */
export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-2/3" />
      <div className="flex gap-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/** Calendario: header + grid del mes + lista de próximos eventos. */
export function CalendarSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Equipo: cabecera + card de entrenador + lista de jugadores. */
export function TeamSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

/** Listas de filas (avisos, cola de aprobación): cabecera + N cards. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Perfil: cabecera + card de datos + botones. */
export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
