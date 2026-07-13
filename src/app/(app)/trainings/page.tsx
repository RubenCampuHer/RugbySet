"use client";

import { ClipboardList, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrainings } from "@/hooks/useTrainings";
import { EmptyState } from "@/components/EmptyState";
import { TrainingCard } from "@/components/trainings/TrainingCard";

export default function TrainingsPage() {
  const { trainings, loading } = useTrainings();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "favs">("all");

  const favNames = useMemo(
    () => new Set(profile?.favTrainings ?? []),
    [profile],
  );

  const shown = trainings.filter((t) => {
    const matchesSearch =
      search === "" ||
      (t.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || favNames.has(t.name ?? "");
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Entrenos" count={trainings.length} />
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
      {search && (
        <p className="text-xs text-muted-foreground">
          {shown.length} de {trainings.length} entrenos
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={tab === "favs" ? Star : ClipboardList}
          title={
            tab === "favs"
              ? "No tienes entrenos favoritos"
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
