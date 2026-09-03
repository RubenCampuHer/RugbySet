"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Lock, Plus, Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { LineupEditorSheet } from "@/components/calendar/LineupEditorSheet";
import { LineupSummary } from "@/components/calendar/LineupSummary";
import { PageHeader } from "@/components/PageHeader";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeam } from "@/hooks/useTeam";
import { createLineup } from "@/lib/actions/lineup";
import { inputValueToFecha } from "@/lib/calendar";
import { isAdmin } from "@/lib/permissions";
import type { LineupDoc } from "@/lib/types";

/** Diálogo mínimo "+ Nueva alineación": nombre + fecha opcional, crea y abre el editor. */
function NewLineupDialog({
  teamname,
  onCreated,
}: {
  teamname: string;
  onCreated: (lineup: LineupDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fechaInput, setFechaInput] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Ponle un nombre a la alineación (p.ej. \"Plan A\", \"Titular vs Leones\")");
      return;
    }
    setCreating(true);
    try {
      const doc = await createLineup(teamname, {
        name,
        matchFecha: fechaInput ? inputValueToFecha(fechaInput) : null,
      });
      setOpen(false);
      setName("");
      setFechaInput("");
      onCreated(doc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la alineación");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xl" className="w-full" />}>
        <Plus className="size-4" /> Nueva alineación
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva alineación</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-lineup-name">Nombre</Label>
            <Input
              id="new-lineup-name"
              value={name}
              placeholder="p.ej. Plan A, Titular vs Leones RC…"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-lineup-fecha">Fecha del partido (opcional)</Label>
            <Input
              id="new-lineup-fecha"
              type="date"
              value={fechaInput}
              onChange={(e) => setFechaInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Puedes dejarla en blanco y usarla como plantilla suelta.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={creating} onClick={() => void create()}>
            {creating ? "Creando…" : "Crear y editar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Centro de control de alineaciones (rediseño 2026-09-03 — antes esta
 * página solo listaba partidos con lineup.published, ahora la alineación
 * es una entidad propia en team.lineups, se puede crear/editar aquí
 * directamente sin pasar por el Calendario).
 *
 * "Publicadas": las lineups cuyo id coincide con algún
 * trainingdays[].lineupId — visibles a todo el equipo. "Borradores y
 * plantillas": el resto (con o sin fecha de partido) — solo
 * coach/ADMIN, igual que el propio LineupEditor.
 */
function TeamLineups() {
  const params = useSearchParams();
  const teamParam = params.get("team");
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();
  const { team, hasTeam, loading } = useTeam(teamParam ?? undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<LineupDoc | null>(null);

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!hasTeam || team === null) {
    return <EmptyState icon={Trophy} title="Equipo no encontrado" />;
  }

  const isMember = profile.teamname === team.teamname;
  const canView = isMember || isAdmin(profile);
  if (!canView) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo el equipo"
        hint="Las alineaciones solo las pueden ver los miembros de este equipo."
      />
    );
  }

  const isManage = team.usercoach === firebaseUser?.uid || isAdmin(profile);

  const all = Object.values(team.lineups);
  const publishedIds = new Set(
    team.trainingdays.map((d) => d.lineupId).filter((id): id is string => Boolean(id)),
  );
  const published = all
    .filter((l) => l.lineupId && publishedIds.has(l.lineupId))
    .sort((a, b) => (a.matchFecha ?? "").localeCompare(b.matchFecha ?? ""));
  const drafts = isManage
    ? all
        .filter((l) => !l.lineupId || !publishedIds.has(l.lineupId))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" />
        Volver
      </button>

      <PageHeader title="Alineaciones" />

      {isManage && (
        <NewLineupDialog teamname={team.teamname!} onCreated={(doc) => setEditing(doc)} />
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Publicadas</p>
        {published.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Sin alineaciones publicadas"
            hint="Aquí aparecerán en cuanto el entrenador publique una para un partido."
          />
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {published.map((l) => {
                const key = l.lineupId!;
                const isExpanded = expanded === key;
                return (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        isManage ? setEditing(l) : setExpanded(isExpanded ? null : key)
                      }
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                    >
                      <span className="flex-1 truncate text-sm font-medium">
                        {l.name || "(sin nombre)"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {l.matchFecha}
                      </span>
                      {!isManage &&
                        (isExpanded ? (
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        ))}
                    </button>
                    {!isManage && isExpanded && (
                      <div className="bg-muted/30 px-3 pb-3">
                        <LineupSummary lineup={l} />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {isManage && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Borradores y plantillas</p>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno por ahora.</p>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {drafts.map((l) => (
                  <button
                    key={l.lineupId}
                    type="button"
                    onClick={() => setEditing(l)}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                  >
                    <span className="flex-1 truncate text-sm font-medium">
                      {l.name || "(sin nombre)"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {l.matchFecha || "plantilla"}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <LineupEditorSheet
        team={team}
        lineup={editing}
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}

export default function TeamLineupsPage() {
  return (
    <Suspense fallback={<ListRowsSkeleton />}>
      <TeamLineups />
    </Suspense>
  );
}
