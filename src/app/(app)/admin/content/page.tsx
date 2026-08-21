"use client";

import { ChevronDown, Lock, SearchX } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
import { SearchInput } from "@/components/SearchInput";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    const matchesSearch =
      search === "" ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.item.author ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesKind && matchesSearch;
  });

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
      <div className="flex gap-2">
        <SearchInput
          className="flex-1"
          placeholder="Buscar por nombre o autor…"
          value={search}
          onChange={setSearch}
        />
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="w-36" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo</SelectItem>
            <SelectItem value="exercise">Ejercicios</SelectItem>
            <SelectItem value="training">Entrenos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Sin resultados" />
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
                        {r.item.author && ` · de ${r.item.author}`}
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
