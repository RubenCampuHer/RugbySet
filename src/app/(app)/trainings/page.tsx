"use client";

import { ClipboardList, FilePlus2, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrainings } from "@/hooks/useTrainings";
import { canCreateContent } from "@/lib/permissions";
import { EmptyState } from "@/components/EmptyState";
import { TrainingCard } from "@/components/trainings/TrainingCard";

type Tab = "all" | "favs" | "own";

export default function TrainingsPage() {
  const { trainings, loading } = useTrainings();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  const favNames = useMemo(
    () => new Set(profile?.favTrainings ?? []),
    [profile],
  );

  // Cuenta de entrenos propios — mismo criterio que Android
  // (ReadTrainingsViewModel: filtered.filter { it.author == user.username }).
  const ownCount = useMemo(
    () => trainings.filter((t) => t.author === profile?.username).length,
    [trainings, profile],
  );

  const shown = trainings.filter((t) => {
    const matchesSearch =
      search === "" ||
      (t.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTags = activeTags.every((tag) => t.etiquetas.includes(tag));
    const matchesTab =
      tab === "all"
        ? true
        : tab === "favs"
          ? favNames.has(t.name ?? "")
          : t.author === profile?.username;
    return matchesSearch && matchesTags && matchesTab;
  });

  // Tags derivadas de lo que queda visible tras búsqueda/tab/etiquetas ya
  // seleccionadas (filtrado facetado) — espejo de ExercisesPage/
  // ReadTrainingsViewModel.computeEtiquetas (el nodo Etiquetas no se usa).
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of shown) {
      for (const tag of t.etiquetas) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [shown]);

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((tg) => tg !== tag) : [...prev, tag],
    );

  if (loading) {
    return <ListSkeleton columns={2} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Entrenos"
        count={trainings.length}
        action={
          canCreateContent(profile) && (
            <Button size="icon-lg" render={<Link href="/trainings/edit" />}>
              <Plus />
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
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
          {shown.length} de {trainings.length} entrenos
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
      {shown.length === 0 ? (
        <EmptyState
          icon={tab === "favs" ? Star : tab === "own" ? FilePlus2 : ClipboardList}
          title={
            tab === "favs"
              ? "No tienes entrenos favoritos"
              : tab === "own"
                ? "No has creado ningún entreno todavía"
                : "No hay entrenos que coincidan"
          }
          hint={
            tab === "favs"
              ? "Toca la estrella en un entreno para guardarlo aquí."
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((t) => (
            <TrainingCard key={t.name} training={t} />
          ))}
        </div>
      )}
    </div>
  );
}
