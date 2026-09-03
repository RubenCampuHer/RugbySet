"use client";

import { Check, Dumbbell } from "lucide-react";
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
import { useExercises } from "@/hooks/useExercises";
import { gradientFor } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Tab = "all" | "favs" | "own";

/**
 * Selector de ejercicios para una sección — espejo de PopupExercise2Training
 * (búsqueda + filtro propios/favoritos/etiquetas, selección múltiple). El
 * padre es quien posee la selección (Set de nombres) y hace el merge
 * preservando el tiempo de los ejercicios ya presentes en la sección, igual
 * que AddTraining.updateExercisesList. Filtro de etiquetas facetado: mismo
 * criterio que ExercisesPage/TrainingPickerSheet (el nodo Etiquetas no se
 * usa, se derivan de lo que queda visible tras búsqueda/tab).
 */
export function ExercisePickerSheet({
  open,
  onOpenChange,
  selection,
  onToggle,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: Set<string>;
  onToggle: (name: string) => void;
  onConfirm: () => void;
}) {
  const { exercises, loading } = useExercises();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const favNames = useMemo(
    () => new Set(profile?.favExercises ?? []),
    [profile],
  );

  const filtered = exercises.filter((e) => {
    const matchesSearch =
      search === "" ||
      (e.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTags = activeTags.every((tag) => e.etiquetas.includes(tag));
    const matchesTab =
      tab === "all"
        ? true
        : tab === "favs"
          ? favNames.has(e.name ?? "")
          : e.author === profile?.username;
    return matchesSearch && matchesTags && matchesTab;
  });

  // Etiquetas facetadas sobre lo que queda visible — mismo criterio que
  // ExercisesPage/TrainingPickerSheet.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filtered) {
      for (const tag of e.etiquetas) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [filtered]);

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((tg) => tg !== tag) : [...prev, tag],
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-hidden sm:max-w-full">
        <SheetHeader>
          <SheetTitle>Añadir ejercicios ({selection.size} seleccionados)</SheetTitle>
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
            // Scroll horizontal en vez de flex-wrap: con el sheet ya
            // limitado a max-h-[85vh], envolver en varias líneas se comía
            // el espacio de la lista scrolleable en pantallas estrechas
            // (hasta 5 líneas con 15 tags en un móvil de 360px). Mismo
            // criterio que la barra de etiquetas de Android (HorizontalScrollView).
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
              {filtered.length} de {exercises.length} ejercicios
            </p>
          )}
        </div>
        {/*
          flex + min-h-0 + flex-col en el propio ScrollArea (no solo
          flex-1): su Viewport interno usa height:100% (size-full), y un
          hijo de bloque normal con % height no lo resuelve dentro de un
          padre que solo se encogió por flexbox — hace falta que el
          ScrollArea sea a su vez contenedor flex para que el 100% cuente
          como definido. Sin esto la lista larga desborda el sheet
          (max-h-[85vh] overflow-hidden) sin poder desplazarse: se corta.
        */}
        <ScrollArea className="flex min-h-0 flex-1 flex-col px-4">
          <div className="space-y-1 pb-4">
            {filtered.map((e) => {
              const name = e.name ?? "";
              const checked = selection.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onToggle(name)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  {e.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export)
                    <img
                      src={e.image}
                      alt=""
                      className="size-12 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br",
                        gradientFor(name),
                      )}
                    >
                      <Dumbbell className="size-5 text-white/40" />
                    </div>
                  )}
                  <span className="line-clamp-1 flex-1 text-sm font-medium">
                    {name || "(sin nombre)"}
                  </span>
                  {checked && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
            {!loading && filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay ejercicios que coincidan.
              </p>
            )}
          </div>
        </ScrollArea>
        <SheetFooter>
          <Button size="xl" onClick={onConfirm}>
            Añadir a la sección
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
