"use client";

import { Check, CircleSlash, Eye, EyeOff, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { saveSquad } from "@/lib/actions/match";
import { sendSquadNotification } from "@/lib/actions/notify";
import { declineReason } from "@/lib/attendance";
import { matchOf } from "@/lib/match";
import { playerInfoOf } from "@/lib/player-info";
import { rankForSquad, responseOf, squadOf, visibleSquad } from "@/lib/squad";
import type { Team, TrainingDay } from "@/lib/types";
import { cn } from "@/lib/utils";

const RESPONSE_ICON = {
  accepted: <Check className="size-3.5 text-accent-foreground" aria-label="Va" />,
  declined: <X className="size-3.5 text-destructive" aria-label="No va" />,
  none: <CircleSlash className="size-3.5 text-muted-foreground" aria-label="Sin responder" />,
} as const;

/**
 * Convocatoria para el cuerpo técnico (2026-09-25): marca a los convocados
 * entre el roster, ordenado por lo que ha respondido cada uno. En cada
 * partido decide si los jugadores la ven y, al hacerla visible, si se avisa
 * a los convocados (casilla, opcional).
 */
export function SquadEditor({ team, day }: { team: Team; day: TrainingDay }) {
  const { profile, firebaseUser } = useAuth();
  const saved = squadOf(team, day);
  const uids = useMemo(() => Object.keys(team.userplayers), [team.userplayers]);
  const profiles = useProfilesByUid(uids);

  const [picked, setPicked] = useState<Set<string>>(() => new Set(saved?.players ?? []));
  const [visible, setVisible] = useState(saved?.visible ?? false);
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  const players = rankForSquad(
    day,
    uids.map((uid) => ({
      uid,
      name: profiles[uid]?.nameSurname || "Jugador",
      injured: playerInfoOf(team, uid).injured === true,
    })),
  );
  const going = players.filter((p) => responseOf(day, p.uid) === "accepted" && !p.injured);

  const toggle = (uid: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const dirty =
    visible !== (saved?.visible ?? false) ||
    picked.size !== (saved?.players.length ?? 0) ||
    (saved?.players ?? []).some((uid) => !picked.has(uid));

  const save = async () => {
    setSaving(true);
    try {
      const list = players.filter((p) => picked.has(p.uid)).map((p) => p.uid);
      await saveSquad(team.teamname!, day.fecha!, { players: list, visible });
      let description: string | undefined;
      if (visible && notify && list.length > 0) {
        const { sent } = await sendSquadNotification({
          teamName: team.teamname!,
          trainingDate: day.fecha!,
          trainingTime: `${day.horaInicio} - ${day.horaFin}`,
          recipientUserIds: list,
          opponent: matchOf(team, day)?.opponent,
          senderUserId: firebaseUser?.uid ?? "",
          senderUsername: profile?.username ?? "",
        });
        description = `Aviso a ${list.length} ${list.length === 1 ? "convocado" : "convocados"}: ${sent} lo reciben en el móvil; el resto lo verá en sus avisos.`;
        setNotify(false);
      }
      toast.success(visible ? "Convocatoria guardada y visible" : "Convocatoria guardada (solo la ve el cuerpo técnico)", {
        description,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la convocatoria");
    } finally {
      setSaving(false);
    }
  };

  if (uids.length === 0) {
    return <p className="text-sm text-muted-foreground">El equipo aún no tiene jugadores.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Convocados: {picked.size}
          <span className="font-normal text-muted-foreground"> de {uids.length}</span>
        </p>
        <div className="flex gap-1">
          {going.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setPicked(new Set(going.map((p) => p.uid)))}
            >
              Los que van ({going.length})
            </Button>
          )}
          {picked.size > 0 && (
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setPicked(new Set())}>
              Ninguno
            </Button>
          )}
        </div>
      </div>

      <ul className="max-h-80 space-y-0.5 overflow-y-auto rounded-lg border p-1">
        {players.map((p) => {
          const response = responseOf(day, p.uid);
          const reason = response === "declined" ? declineReason(team, day, p.uid) : null;
          return (
            <li key={p.uid}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted",
                  picked.has(p.uid) && "bg-brand/10",
                )}
              >
                <input
                  type="checkbox"
                  checked={picked.has(p.uid)}
                  disabled={saving}
                  onChange={() => toggle(p.uid)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  {reason && <span className="block truncate text-xs text-muted-foreground">{reason}</span>}
                </span>
                {p.injured && <span className="shrink-0 text-xs text-destructive">Lesionado</span>}
                {RESPONSE_ICON[response]}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={visible}
            disabled={saving}
            onChange={(e) => setVisible(e.target.checked)}
            className="size-4 accent-primary"
          />
          Visible para los jugadores
        </label>
        {visible && (
          <label className="flex items-center gap-2 pl-6 text-sm">
            <input
              type="checkbox"
              checked={notify}
              disabled={saving}
              onChange={(e) => setNotify(e.target.checked)}
              className="size-4 accent-primary"
            />
            Avisar a los convocados al guardar
          </label>
        )}
        <p className="text-xs text-muted-foreground">
          {visible
            ? "Cada jugador verá si está convocado y la lista de convocados."
            : "Mientras no sea visible, solo la ve el cuerpo técnico."}
        </p>
      </div>

      <Button disabled={saving || (!dirty && !notify)} onClick={() => void save()}>
        {saving ? "Guardando…" : visible && notify ? "Guardar y avisar" : "Guardar convocatoria"}
      </Button>
    </div>
  );
}

/** Estado de la convocatoria en la cabecera del cuerpo técnico: "18 convocados · visible". */
export function SquadStatus({ team, day }: { team: Team; day: TrainingDay }) {
  const squad = squadOf(team, day);
  if (!squad || squad.players.length === 0) return null;
  return (
    <Badge variant="outline" className="gap-1">
      {squad.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
      {squad.players.length} {squad.players.length === 1 ? "convocado" : "convocados"}{squad.visible ? "" : " · borrador"}
    </Badge>
  );
}

/** Lo que ve el jugador cuando la convocatoria es visible. */
export function SquadCard({ team, day, myUid }: { team: Team; day: TrainingDay; myUid: string }) {
  const squad = visibleSquad(team, day);
  const profiles = useProfilesByUid(squad?.players ?? []);
  if (!squad) return null;
  const inSquad = squad.players.includes(myUid);
  const names = squad.players.map((uid) => profiles[uid]?.nameSurname || "Jugador").sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className={cn("flex items-center gap-2 font-medium", inSquad ? "text-brand" : "text-muted-foreground")}>
        <Users className="size-4" />
        {inSquad ? "Estás convocado" : "No estás convocado para este partido"}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Convocados ({names.length})</summary>
        <ul className="mt-2 columns-2 gap-4 text-sm">
          {names.map((n, i) => (
            <li key={`${n}-${i}`} className="truncate">
              {n}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
