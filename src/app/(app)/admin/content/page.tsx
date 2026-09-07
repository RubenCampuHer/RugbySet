"use client";

import { ChevronDown, Lock, SearchX, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
import { SearchInput } from "@/components/SearchInput";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllContent } from "@/hooks/useAllContent";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Exercise, Training } from "@/lib/types";

type Kind = "all" | "exercise" | "training";

// Base UI: <SelectValue /> sin hijos pinta el VALOR crudo ("exercise"), no la
// etiqueta del item — por eso el trigger salía en inglés. Mismo patrón que el
// resto del repo: siempre pasar la etiqueta como hijo.
const KIND_LABELS: Record<Kind, string> = {
  all: "Todo",
  exercise: "Ejercicios",
  training: "Entrenos",
};

/** Valores reservados del filtro de autor (nunca colisionan con un username real: no llevan espacios ni "*"). */
const ALL_AUTHORS = "* todos *";
const NO_AUTHOR = "* sin autor *";

type Row =
  | { kind: "exercise"; name: string; item: Exercise }
  | { kind: "training"; name: string; item: Training };

/**
 * Detalle completo de un ejercicio — mismo contenido que /exercises/detail,
 * pero sin pasar por canViewExercise (esta vista es el bypass acotado a
 * admin/content, no un cambio en permissions.ts).
 */
function ExerciseDetailBody({ exercise }: { exercise: Exercise }) {
  return (
    <div className="space-y-2 border-t border-border pt-2">
      {exercise.image && (
        // eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export)
        <img
          src={exercise.image}
          alt={exercise.name ?? ""}
          className="max-h-64 w-full rounded-lg object-contain"
        />
      )}
      {exercise.descLarga && (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{exercise.descLarga}</p>
      )}
      {exercise.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {exercise.etiquetas.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Detalle completo de un entreno — secciones + ejercicios embebidos (ya vienen completos en el nodo, sin fetch adicional). */
function TrainingDetailBody({ training }: { training: Training }) {
  return (
    <div className="space-y-3 border-t border-border pt-2">
      {training.tiempoTotal && (
        <p className="text-sm text-muted-foreground">Duración total: {training.tiempoTotal}</p>
      )}
      {training.sections.map((section, i) => (
        <div key={i} className="space-y-1 rounded-lg bg-muted/40 p-2">
          <p className="text-sm font-medium">
            {section.sectionName || `Sección ${i + 1}`}
            {section.tiempoSeccion > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({section.tiempoSeccion} min)</span>
            )}
          </p>
          {section.exercises.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin ejercicios.</p>
          ) : (
            <ul className="space-y-0.5">
              {section.exercises.map((et, j) => (
                <li key={j} className="text-sm text-muted-foreground">
                  · {et.exercise?.name ?? "(ejercicio eliminado)"}
                  {et.tiempoExercise > 0 && ` — ${et.tiempoExercise} min`}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {training.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {training.etiquetas.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminContentPage() {
  const { profile } = useAuth();
  const { exercises, trainings, loading } = useAllContent();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [author, setAuthor] = useState<string>(ALL_AUTHORS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Autores con su nº de contenidos (ejercicios + entrenos), de más a menos —
  // calculado sobre TODO el contenido (no sobre lo ya filtrado) para que la
  // lista del desplegable sea estable mientras se combina con tipo/búsqueda.
  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    let withoutAuthor = 0;
    for (const item of [...exercises, ...trainings]) {
      if (!item.name) continue;
      if (item.author) counts.set(item.author, (counts.get(item.author) ?? 0) + 1);
      else withoutAuthor += 1;
    }
    const list = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .map(([name, count]) => ({ name, count }));
    return { list, withoutAuthor };
  }, [exercises, trainings]);

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para ver todo el contenido."
      />
    );
  }

  const rows: Row[] = [
    ...exercises
      .filter((e) => e.name)
      .map((e) => ({ kind: "exercise" as const, name: e.name!, item: e })),
    ...trainings
      .filter((t) => t.name)
      .map((t) => ({ kind: "training" as const, name: t.name!, item: t })),
  ];

  const filtered = rows.filter((r) => {
    const matchesKind = kind === "all" || r.kind === kind;
    const matchesAuthor =
      author === ALL_AUTHORS ||
      (author === NO_AUTHOR ? !r.item.author : r.item.author === author);
    const matchesSearch =
      search === "" ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.item.author ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesKind && matchesAuthor && matchesSearch;
  });

  const hasFilters = search !== "" || kind !== "all" || author !== ALL_AUTHORS;
  const clearFilters = () => {
    setSearch("");
    setKind("all");
    setAuthor(ALL_AUTHORS);
  };
  const authorLabel =
    author === ALL_AUTHORS ? "Todos los autores" : author === NO_AUTHOR ? "Sin autor" : author;

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Todo el contenido" count={rows.length} />
      <p className="text-sm text-muted-foreground">
        Incluye contenido Privado y de Equipo de terceros — esta vista es solo
        de administración, no cambia lo que ves en /ejercicios ni /entrenos.
        Toca una fila para ver el detalle completo.
      </p>
      <div className="space-y-2">
        <SearchInput
          placeholder="Buscar por nombre o autor…"
          value={search}
          onChange={setSearch}
        />
        <div className="flex flex-wrap gap-2">
          <Select value={kind} onValueChange={(v) => setKind((v as Kind | null) ?? "all")}>
            <SelectTrigger className="w-32" aria-label="Filtrar por tipo">
              <SelectValue>{KIND_LABELS[kind]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Filtro por autor (2026-09-07): desplegable con conteo, ordenado por
              volumen. Atajo: tocar "de X" en cualquier fila fija este mismo filtro. */}
          <Select value={author} onValueChange={(v) => setAuthor(v ?? ALL_AUTHORS)}>
            <SelectTrigger className="min-w-0 max-w-full flex-1 sm:flex-none sm:w-56" aria-label="Filtrar por autor">
              <SelectValue className="min-w-0 truncate">{authorLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AUTHORS}>Todos los autores</SelectItem>
              {authors.list.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="truncate">{a.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{a.count}</span>
                  </span>
                </SelectItem>
              ))}
              {authors.withoutAuthor > 0 && (
                <SelectItem value={NO_AUTHOR}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>Sin autor</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{authors.withoutAuthor}</span>
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {filtered.length} de {rows.length}
            </span>
            {author !== ALL_AUTHORS && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Autor: {authorLabel}
                <button
                  type="button"
                  aria-label="Quitar filtro de autor"
                  className="rounded-full p-0.5 hover:bg-background/60"
                  onClick={() => setAuthor(ALL_AUTHORS)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
              Quitar filtros
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          hint={hasFilters ? "Prueba a quitar algún filtro." : undefined}
          action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Quitar filtros</Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const key = `${r.kind}-${r.name}`;
            const isOpen = expanded.has(key);
            return (
              <Card key={key}>
                <CardContent className="space-y-1.5 py-3">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-2 text-left"
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.kind === "exercise" ? "Ejercicio" : "Entreno"}
                        {r.item.author && (
                          <>
                            {" · de "}
                            {/* Atajo: filtrar por este autor sin abrir el desplegable.
                                stopPropagation para no plegar/desplegar la fila. */}
                            <span
                              role="button"
                              tabIndex={0}
                              className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              aria-label={`Filtrar por autor ${r.item.author}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAuthor(r.item.author!);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAuthor(r.item.author!);
                                }
                              }}
                            >
                              {r.item.author}
                            </span>
                          </>
                        )}
                        {r.item.teamname && ` · ${r.item.teamname}`}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="flex flex-wrap justify-end gap-1">
                        <PrivacyBadge privacy={r.item.privacy} />
                        <ApprovalBadge status={r.item.approvalStatus} />
                      </span>
                      <ChevronDown
                        className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                      />
                    </span>
                  </button>
                  {r.item.descCorta && <p className="text-sm">{r.item.descCorta}</p>}
                  {isOpen &&
                    (r.kind === "exercise" ? (
                      <ExerciseDetailBody exercise={r.item} />
                    ) : (
                      <TrainingDetailBody training={r.item} />
                    ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
