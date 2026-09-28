"use client";

import { Lock, Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClub } from "@/hooks/useClub";
import { useClubTeams } from "@/hooks/useClubTeams";
import { sendClubMessage } from "@/lib/actions/notify";
import {
  CLUB_NOTICE_TARGET_LABEL,
  CLUB_NOTICE_TARGETS,
  type ClubNoticeTarget,
  countRecipients,
  recipientsByTeam,
} from "@/lib/club-notify";
import { isClubDirector } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Avisos del club (2026-09-28): la dirección escribe a todo el club o a
 * equipos concretos, y dentro a todos, solo jugadores o solo entrenadores.
 * Llega a la campana de cada uno (y al móvil si tiene la app con avisos).
 */
export default function ClubNotifyPage() {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const { club, loading } = useClub();
  const { teams, loading: loadingTeams } = useClubTeams(club?.teams ?? []);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [target, setTarget] = useState<ClubNoticeTarget>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (loading || profile === null || (club && loadingTeams)) return <ListRowsSkeleton />;
  if (!club || !isClubDirector(club, uid, profile)) {
    return <EmptyState icon={Lock} title="Solo la dirección del club" hint="Los avisos del club los envía su dirección." />;
  }

  const names = teams.map((t) => t.teamname!).filter(Boolean);
  const chosen = selected ?? new Set(names); // por defecto, todo el club
  const groups = recipientsByTeam(teams, chosen, target, uid);
  const total = countRecipients(groups);
  const allChosen = names.every((n) => chosen.has(n));

  const toggle = (name: string) => {
    const next = new Set(chosen);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const send = async () => {
    if (!message.trim() || total === 0) return;
    setSending(true);
    try {
      const r = await sendClubMessage({
        clubId: club.clubId!,
        clubName: club.clubname ?? "el club",
        title,
        message,
        groups,
        senderUserId: uid!,
        senderUsername: profile.username ?? "",
      });
      toast.success(`Aviso enviado a ${r.recipients} ${r.recipients === 1 ? "persona" : "personas"} (${r.sent} en el móvil).`);
      setTitle("");
      setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el aviso");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/club" label="Club" />
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Megaphone className="size-6" /> Avisos del club
      </h1>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Equipos</Label>
              <button
                type="button"
                className="text-xs font-medium text-brand hover:underline"
                onClick={() => setSelected(allChosen ? new Set() : new Set(names))}
              >
                {allChosen ? "Quitar todos" : "Todo el club"}
              </button>
            </div>
            {names.length === 0 ? (
              <p className="text-sm text-muted-foreground">El club no tiene equipos todavía.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {names.map((name) => (
                  <label key={name} className="cursor-pointer">
                    <input type="checkbox" className="peer sr-only" checked={chosen.has(name)} onChange={() => toggle(name)} />
                    <Badge
                      variant={chosen.has(name) ? "default" : "outline"}
                      className="min-h-8 px-3 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                    >
                      {name}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>

          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">A quién</legend>
            {CLUB_NOTICE_TARGETS.map((t) => (
              <label
                key={t}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-muted/50", target === t && "bg-muted/50")}
              >
                <input type="radio" name="target" className="size-4 accent-primary" checked={target === t} onChange={() => setTarget(t)} />
                {CLUB_NOTICE_TARGET_LABEL[t]}
              </label>
            ))}
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="notice-title">Título (opcional)</Label>
            <Input
              id="notice-title"
              value={title}
              maxLength={120}
              placeholder={`Aviso de ${club.clubname ?? "el club"}`}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notice-message">Mensaje</Label>
            <Textarea id="notice-message" rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {total === 0 ? "Nadie recibirá el aviso con esta selección." : `Le llegará a ${total} ${total === 1 ? "persona" : "personas"}.`}
            </p>
            <Button size="xl" disabled={sending || !message.trim() || total === 0} onClick={() => void send()}>
              <Send /> {sending ? "Enviando…" : "Enviar aviso"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
