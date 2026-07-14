"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SearchInput } from "@/components/SearchInput";
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
import { cn } from "@/lib/utils";

type Tab = "all" | "favs" | "own";

/**
 * Selector de ejercicios para una sección — espejo de PopupExercise2Training
 * (búsqueda + filtro propios/favoritos, selección múltiple). El padre es
 * quien posee la selección (Set de nombres) y hace el merge preservando el
 * tiempo de los ejercicios ya presentes en la sección, igual que
 * AddTraining.updateExercisesList.
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

  const favNames = useMemo(
    () => new Set(profile?.favExercises ?? []),
    [profile],
  );

  const filtered = exercises.filter((e) => {
    const matchesSearch =
      search === "" ||
      (e.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      tab === "all"
        ? true
        : tab === "favs"
          ? favNames.has(e.name ?? "")
          : e.author === profile?.username;
    return matchesSearch && matchesTab;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:max-w-full">
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
        </div>
        <ScrollArea className="flex-1 px-4">
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
                    "flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition-colors",
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <span className="line-clamp-1 text-sm font-medium">
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
