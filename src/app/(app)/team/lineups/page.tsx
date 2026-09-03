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
import { isAdmin } from "@/lib/permissions";
import type { LineupDoc } from "@/lib/types";

/** Diálogo mínimo "+ Nueva alineación": solo nombre, crea y abre el editor. */
function NewLineupDialog({
  teamname,
  onCreated,
}: {
  teamname: string;
  onCreated: (lineup: LineupDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Ponle un nombre a la alineación (p.ej. \"Plan A\", \"Titular vs Leones\")");
      return;
    }
    setCreating(true);
    try {
      const doc = await createLineup(teamname, { name });
      setOpen(false);
      setName("");
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
 * Biblioteca de alineaciones (rediseño 2026-09-03 — la alineación es una
 * entidad propia en team.lineups, se crea/edita/borra aquí; asignarla a un
 * partido concreto es una acción exclusiva del Calendario, esta página no
 * tiene ningún control para eso, solo muestra a qué partido(s) está
 * asignada cada una a modo informativo).
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

  // Por partido asignado a cada lineupId — solo informativo (ver
  // LineupEditor: la asignación en sí es exclusiva del Calendario).
  const assignedFechasByLineup = new Map<string, string[]>();
  for (const d of team.trainingdays) {
    if (!d.lineupId || !d.fecha) continue;
    const list = assignedFechasByLineup.get(d.lineupId) ?? [];
    list.push(d.fecha);
    assignedFechasByLineup.set(d.lineupId, list);
  }

  const lineups = Object.values(team.lineups).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

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
        <p className="text-sm font-medium text-muted-foreground">Alineaciones</p>
        {lineups.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Sin alineaciones todavía"
            hint={
              isManage
                ? "Crea la primera con el botón de arriba."
                : "Aquí aparecerán en cuanto el entrenador cree alguna."
            }
          />
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {lineups.map((l) => {
                const key = l.lineupId!;
                const isExpanded = expanded === key;
                const fechas = assignedFechasByLineup.get(key) ?? [];
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
                        {fechas.length > 0 ? fechas.join(", ") : "sin partido asignado"}
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

      {isManage && lineups.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Para asignar una alineación a un partido, ábrelo desde el Calendario.
        </p>
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
