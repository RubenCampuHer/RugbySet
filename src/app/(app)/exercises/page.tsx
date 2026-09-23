"use client";

import { FilePlus2, Plus, SearchX, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { ExerciseCard } from "@/components/exercises/ExerciseCard";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyClubId } from "@/hooks/useMyClubId";
import { matchesLibraryTab, type LibraryTab } from "@/lib/library";
import { useExercises } from "@/hooks/useExercises";
import { canCreateContent } from "@/lib/permissions";

type Tab = LibraryTab;

export default function ExercisesPage() {
  const { exercises, loading } = useExercises();
  const { profile } = useAuth();
  const { clubId: myClubId } = useMyClubId();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  const favNames = useMemo(
    () => new Set(profile?.favExercises ?? []),
    [profile],
  );

  // Cuenta de ejercicios propios — mismo criterio que Android
  // (ReadExercisesViewModel: filtered.filter { it.author == user.username }).
  const ownCount = useMemo(
    () => exercises.filter((e) => e.author === profile?.username).length,
    [exercises, profile],
  );

  const filtered = exercises.filter((e) => {
    const matchesSearch =
      search === "" ||
      (e.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTags = activeTags.every((tag) => e.etiquetas.includes(tag));
    const matchesTab = matchesLibraryTab(e, tab, {
      username: profile?.username,
      favNames,
      myClubId,
    });
    return matchesSearch && matchesTags && matchesTab;
  });

  // Tags derivadas de lo que queda visible tras búsqueda/tab/etiquetas ya
  // seleccionadas (filtrado facetado) — el nodo Etiquetas no se usa (misma
  // decisión que el plan v2 §F3).
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filtered) {
      for (const tag of e.etiquetas) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [filtered]);

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  if (loading) {
    return <ListSkeleton />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ejercicios"
        count={exercises.length}
        action={
          canCreateContent(profile) && (
            <Button size="icon-lg" render={<Link href="/exercises/edit" />}>
              <Plus />
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {myClubId && <TabsTrigger value="club">Del club</TabsTrigger>}
          <TabsTrigger value="favs">Favoritos ({favNames.size})</TabsTrigger>
          <TabsTrigger value="own">Propios ({ownCount})</TabsTrigger>
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
          icon={tab === "favs" ? Star : tab === "own" ? FilePlus2 : SearchX}
          title={
            tab === "favs"
              ? "No tienes ejercicios favoritos"
              : tab === "own"
                ? "No has creado ningún ejercicio todavía"
                : tab === "club"
                  ? "Tu club aún no ha compartido ejercicios"
                : "No hay ejercicios que coincidan"
          }
          hint={
            tab === "favs"
              ? "Toca la estrella en un ejercicio para guardarlo aquí."
              : tab === "club"
                ? "Los ejercicios con privacidad Club aparecen aquí cuando la dirección del club los aprueba."
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
