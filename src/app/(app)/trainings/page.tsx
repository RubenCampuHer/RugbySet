"use client";

import { ClipboardList, FilePlus2, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListSkeleton } from "@/components/skeletons";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrainings } from "@/hooks/useTrainings";
import { EmptyState } from "@/components/EmptyState";
import { TrainingCard } from "@/components/trainings/TrainingCard";

type Tab = "all" | "favs" | "own";

export default function TrainingsPage() {
  const { trainings, loading } = useTrainings();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
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
    const matchesTab =
      tab === "all"
        ? true
        : tab === "favs"
          ? favNames.has(t.name ?? "")
          : t.author === profile?.username;
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return <ListSkeleton columns={2} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Entrenos" count={trainings.length} />
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
      {search && (
        <p className="text-xs text-muted-foreground">
          {shown.length} de {trainings.length} entrenos
        </p>
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
