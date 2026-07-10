"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrainings } from "@/hooks/useTrainings";
import type { Training } from "@/lib/types";

function TrainingCard({ training }: { training: Training }) {
  const name = training.name ?? "(sin nombre)";
  const exerciseCount = training.sections.reduce(
    (sum, s) => sum + s.exercises.length,
    0,
  );
  return (
    <Link href={`/trainings/detail?name=${encodeURIComponent(name)}`}>
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader>
          <CardTitle className="line-clamp-1 text-base">{name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {training.descCorta && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {training.descCorta}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            ⏱ {training.tiempoTotal ?? "?"} min · {training.sections.length}{" "}
            secciones · {exerciseCount} ejercicios
          </p>
          <div className="flex flex-wrap gap-1">
            {training.privacy && <Badge variant="outline">{training.privacy}</Badge>}
            {training.etiquetas.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

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
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Entrenos</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "favs")}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="favs">Favoritos ({favNames.size})</TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        placeholder="Buscar por nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {shown.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {tab === "favs"
            ? "No tienes entrenos favoritos."
            : "No hay entrenos que coincidan."}
        </p>
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
