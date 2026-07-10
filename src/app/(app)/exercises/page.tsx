"use client";

import { useMemo, useState } from "react";
import { ExerciseCard } from "@/components/exercises/ExerciseCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useExercises } from "@/hooks/useExercises";

export default function ExercisesPage() {
  const { exercises, loading } = useExercises();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Tags derivadas del contenido visible (el nodo Etiquetas no se usa —
  // misma decisión que el plan v2 §F3).
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of exercises) {
      for (const tag of e.etiquetas) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [exercises]);

  const filtered = exercises.filter((e) => {
    const matchesSearch =
      search === "" ||
      (e.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTags = activeTags.every((tag) => e.etiquetas.includes(tag));
    return matchesSearch && matchesTags;
  });

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ejercicios</h1>
      <Input
        placeholder="Buscar por nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.slice(0, 15).map((tag) => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}>
              <Badge variant={activeTags.includes(tag) ? "default" : "outline"}>
                {tag}
              </Badge>
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No hay ejercicios que coincidan.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {filtered.map((e) => (
            <ExerciseCard key={e.name} exercise={e} />
          ))}
        </div>
      )}
    </div>
  );
}
