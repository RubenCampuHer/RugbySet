"use client";

import { get, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClub, getClubByCode, leaveClub, requestJoinClub } from "@/lib/actions/club";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { ClubSchema } from "@/lib/schemas/club";
import type { Club, Team } from "@/lib/types";

/** Coach cuyo equipo ya pertenece a un club — solo lectura + salir. */
function AlreadyInClub({ team }: { team: Team }) {
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);
  const clubId = team.clubId;

  // Lectura puntual del club (Clubs es de lectura abierta a cualquier
  // autenticado) — solo para mostrar nombre/código, no requiere useClub.
  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    void get(ref(db, `Clubs/${clubId}`)).then((snap) => {
      if (cancelled) return;
      setClub(snap.exists() ? parseOr(ClubSchema, snap.val(), `Clubs/${clubId}`) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const leave = async () => {
    setLeaving(true);
    try {
      await leaveClub(team.teamname!);
      toast.success("Tu equipo ha salido del club");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo salir del club");
    } finally {
      setLeaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tu equipo pertenece a un club</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <AvatarInitials name={club?.clubname ?? "Club"} src={club?.clubicon} />
          <p className="font-medium">{club?.clubname ?? "Cargando…"}</p>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" disabled={leaving}>
              Salir del club
            </Button>
          }
          title="¿Salir del club?"
          description="Tu equipo deja de pertenecer al club; su admin ya no podrá gestionarlo. Puedes volver a solicitar el ingreso más adelante."
          confirmLabel="Salir del club"
          destructive
          onConfirm={leave}
        />
      </CardContent>
    </Card>
  );
}

/** Coach cuyo equipo no pertenece a ningún club — unirse por código o crear uno. */
function NotInClub({ team, uid }: { team: Team; uid: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Club | null | undefined>(undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [creating, setCreating] = useState(false);

  const search = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setPreview(undefined);
    try {
      const found = await getClubByCode(trimmed);
      setPreview(found);
      if (!found) toast.error("Código no encontrado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al buscar el club");
    } finally {
      setBusy(false);
    }
  };

  const requestJoin = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await requestJoinClub(preview, team.teamname!);
      toast.success(`Solicitud enviada a ${preview.clubname}. El admin del club debe aceptarla.`);
      setPreview(undefined);
      setCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!clubName.trim() || !clubCode.trim()) return;
    setCreating(true);
    try {
      await createClub({
        clubName: clubName.trim(),
        clubCode: clubCode.trim(),
        clubIconUrl: null,
        teamname: team.teamname!,
        uid,
      });
      toast.success(`Club "${clubName.trim()}" creado`);
      setCreateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el club");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Club</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Tu equipo no pertenece a ningún club todavía.
        </p>
        <div className="flex gap-2">
          <Input
            value={code}
            placeholder="Código del club"
            onChange={(e) => { setCode(e.target.value); setPreview(undefined); }}
            onKeyDown={(e) => e.key === "Enter" && void search()}
          />
          <Button variant="outline" disabled={busy || !code.trim()} onClick={() => void search()}>
            Buscar
          </Button>
        </div>
        {preview && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-3">
            <div className="flex items-center gap-2">
              <AvatarInitials name={preview.clubname} src={preview.clubicon} size="sm" />
              <span className="text-sm font-medium">{preview.clubname}</span>
            </div>
            <Button size="sm" disabled={busy} onClick={() => void requestJoin()}>
              Solicitar ingreso
            </Button>
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button variant="outline" className="w-full" />}>
            Crear un club nuevo
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear club</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={clubName}
                placeholder="Nombre del club"
                onChange={(e) => setClubName(e.target.value)}
              />
              <Input
                value={clubCode}
                placeholder="Código para que otros equipos lo encuentren"
                onChange={(e) => setClubCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tu equipo ({team.teamname}) será el primer miembro y tú quedas como admin del club.
              </p>
            </div>
            <DialogFooter>
              <Button disabled={!clubName.trim() || !clubCode.trim() || creating} onClick={() => void create()}>
                {creating ? "Creando…" : "Crear club"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/** Estado de membresía de club del equipo propio — decide cuál de los dos mostrar. */
export function ClubMembershipCard({ team, uid }: { team: Team; uid: string }) {
  return team.clubId ? <AlreadyInClub team={team} /> : <NotInClub team={team} uid={uid} />;
}
