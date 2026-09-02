"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SearchInput } from "@/components/SearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrainings } from "@/hooks/useTrainings";
import { cn } from "@/lib/utils";

type Tab = "all" | "favs" | "own";

/**
 * Selector de entreno para un día del calendario — mismo patrón que
 * ExercisePickerSheet (búsqueda + propios/favoritos), con filtro por
 * etiqueta añadido (facetado, igual que TrainingsPage) y selección única
 * en vez de múltiple.
 */
export function TrainingPickerSheet({
  open,
  onOpenChange,
  value,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onConfirm: (name: string) => void;
}) {
  const { trainings, loading } = useTrainings();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);

  const favNames = useMemo(
    () => new Set(profile?.favTrainings ?? []),
    [profile],
  );

  const filtered = trainings.filter((t) => {
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

  // Etiquetas facetadas sobre lo que queda visible — mismo criterio que
  // TrainingsPage/ExercisesPage.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of filtered) {
      for (const tag of t.etiquetas) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [filtered]);

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((tg) => tg !== tag) : [...prev, tag],
    );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setSelected(value);
        onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="max-h-[85vh] overflow-hidden sm:max-w-full">
        <SheetHeader>
          <SheetTitle>Elegir entreno</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <SearchInput
            placeholder="Buscar por nombre…"
            value={search}
            onChange={setSearch}
          />
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="favs">Favoritos</TabsTrigger>
              <TabsTrigger value="own">Propios</TabsTrigger>
            </TabsList>
          </Tabs>
          {allTags.length > 0 && (
            // Scroll horizontal en vez de flex-wrap: con el sheet limitado a
            // max-h-[85vh], envolver en varias líneas se comía el espacio de
            // la lista scrolleable en pantallas estrechas. Mismo criterio
            // que ExercisePickerSheet y la barra de etiquetas de Android
            // (HorizontalScrollView).
            <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
              {allTags.slice(0, 15).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
          {(search || activeTags.length > 0) && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {trainings.length} entrenos
            </p>
          )}
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1 pb-4">
            {filtered.map((t) => {
              const name = t.name ?? "";
              const checked = selected === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelected(name)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors",
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-sm font-medium">
                      {name || "(sin nombre)"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t.tiempoTotal ?? "?"} min
                      </span>
                      {checked && <Check className="size-4 text-primary" />}
                    </span>
                  </span>
                  {t.descCorta && (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {t.descCorta}
                    </span>
                  )}
                </button>
              );
            })}
            {!loading && filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay entrenos que coincidan.
              </p>
            )}
          </div>
        </ScrollArea>
        <SheetFooter>
          <Button size="xl" disabled={!selected} onClick={() => onConfirm(selected)}>
            Elegir entreno
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
