"use client";

import { SearchX, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { ExerciseCard } from "@/components/exercises/ExerciseCard";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExercises } from "@/hooks/useExercises";

export default function ExercisesPage() {
  const { exercises, loading } = useExercises();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [tab, setTab] = useState<"all" | "favs">("all");

  const favNames = useMemo(
    () => new Set(profile?.favExercises ?? []),
    [profile],
  );

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
    const matchesTab = tab === "all" || favNames.has(e.name ?? "");
    return matchesSearch && matchesTags && matchesTab;
  });

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  if (loading) {
    return <ListSkeleton />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ejercicios" count={exercises.length} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "favs")}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="favs">Favoritos ({favNames.size})</TabsTrigger>
        </TabsList>
      </Tabs>
      <SearchInput
        placeholder="Buscar por nombre…"
        value={search}
        onChange={setSearch}
      />
      {(search || activeTags.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} de {exercises.length} ejercicios
        </p>
      )}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.slice(0, 15).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Badge
                className="px-3 py-1.5"
                variant={activeTags.includes(tag) ? "default" : "outline"}
              >
                {tag}
              </Badge>
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          icon={tab === "favs" ? Star : SearchX}
          title={
            tab === "favs"
              ? "No tienes ejercicios favoritos"
              : "No hay ejercicios que coincidan"
          }
          hint={
            tab === "favs"
              ? "Toca la estrella en un ejercicio para guardarlo aquí."
              : undefined
          }
        />
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
