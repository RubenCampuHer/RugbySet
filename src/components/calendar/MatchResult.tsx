"use client";

import { FileText, Link2, Play, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMatchVideo,
  removeMatchReport,
  removeMatchVideo,
  saveMatchResult,
  uploadMatchReport,
} from "@/lib/actions/match";
import { sendMatchResultNotification } from "@/lib/actions/notify";
import {
  MATCH_OUTCOME_LABEL,
  MATCH_OUTCOME_SHORT,
  MATCH_REPORT_MAX_BYTES,
  MATCH_STATUS_LABEL,
  MATCH_STATUSES,
  type MatchOutcome,
  type MatchStatus,
  matchOf,
  matchOutcome,
  parseScore,
  scoreline,
  videoSiteLabel,
  youtubeId,
} from "@/lib/match";
import type { Match, Team, TrainingDay } from "@/lib/types";
import { cn } from "@/lib/utils";

const OUTCOME_CLASS: Record<MatchOutcome, string> = {
  win: "bg-accent text-accent-foreground",
  draw: "bg-muted text-muted-foreground",
  loss: "bg-destructive/15 text-destructive",
};

/** "V 24 – 10" compacto para la agenda; nada si el partido no tiene resultado. */
export function MatchOutcomeChip({ team, day }: { team: Team; day: TrainingDay }) {
  const match = matchOf(team, day);
  const outcome = matchOutcome(match);
  if (!match || !outcome) return null;
  return (
    <span
      title={MATCH_OUTCOME_LABEL[outcome]}
      className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums", OUTCOME_CLASS[outcome])}
    >
      {MATCH_OUTCOME_SHORT[outcome]} {scoreline(match)}
    </span>
  );
}

/** Botonera de opciones excluyentes (casa/fuera, estado). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-50",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ScorePair({
  label,
  ours,
  theirs,
  onOurs,
  onTheirs,
  disabled,
}: {
  label: string;
  ours: string;
  theirs: string;
  onOurs: (v: string) => void;
  onTheirs: (v: string) => void;
  disabled?: boolean;
}) {
  const clean = (v: string) => v.replace(/\D/g, "").slice(0, 3);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={ours}
          placeholder="—"
          aria-label={`${label}: nosotros`}
          disabled={disabled}
          onChange={(e) => onOurs(clean(e.target.value))}
          className="w-16 text-center"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          inputMode="numeric"
          value={theirs}
          placeholder="—"
          aria-label={`${label}: rival`}
          disabled={disabled}
          onChange={(e) => onTheirs(clean(e.target.value))}
          className="w-16 text-center"
        />
      </div>
    </div>
  );
}

function VideoList({
  match,
  onRemove,
}: {
  match: Match;
  onRemove?: (id: string) => void;
}) {
  const videos = Object.entries(match.videos)
    .filter((e): e is [string, NonNullable<(typeof e)[1]>] => e[1] != null)
    .sort((a, b) => (a[1].addedAt ?? 0) - (b[1].addedAt ?? 0));
  if (videos.length === 0) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {videos.map(([id, v]) => {
        const yt = youtubeId(v.url);
        return (
          <li key={id} className="flex min-w-0 items-center gap-2 rounded-lg border p-1.5">
            <a
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
            >
              {yt ? (
                <span className="relative shrink-0 overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
                  <img
                    src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`}
                    alt=""
                    className="h-12 w-20 object-cover"
                    loading="lazy"
                  />
                  <Play className="absolute inset-0 m-auto size-5 fill-white text-white drop-shadow" />
                </span>
              ) : (
                <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Link2 className="size-5 text-muted-foreground" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{v.title || videoSiteLabel(v.url)}</span>
                {v.title && <span className="block truncate text-xs text-muted-foreground">{videoSiteLabel(v.url)}</span>}
              </span>
            </a>
            {onRemove && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Quitar vídeo"
                onClick={() => onRemove(id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Resultado para todos (jugadores y cuerpo técnico): marcador con V/E/D,
 * ensayos, vídeos y acta. Nada si todavía no hay datos del partido.
 */
export function MatchResultCard({ team, day }: { team: Team; day: TrainingDay }) {
  const match = matchOf(team, day);
  if (!match) return null;
  const outcome = matchOutcome(match);
  const score = match.status === "played" ? scoreline(match) : null;
  const hasTries = match.triesFor != null && match.triesAgainst != null;
  const hasVideos = Object.values(match.videos).some(Boolean);
  if (!match.opponent && !score && match.status !== "abandoned" && !hasVideos && !match.report) return null;

  const us = team.teamname || "Nosotros";
  const them = match.opponent || "Rival";
  const [left, right] = match.home === false ? [them, us] : [us, them];

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {outcome && <Badge className={cn("border-transparent", OUTCOME_CLASS[outcome])}>{MATCH_OUTCOME_LABEL[outcome]}</Badge>}
        {match.status === "abandoned" && <Badge variant="outline">Suspendido</Badge>}
        {match.home != null && (
          <span className="text-xs text-muted-foreground">{match.home ? "En casa" : "Fuera"}</span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <span className="truncate text-sm font-medium">{left}</span>
        <span className="text-2xl font-bold tabular-nums">{score ?? "vs"}</span>
        <span className="truncate text-sm font-medium">{right}</span>
      </div>
      {score && hasTries && (
        <p className="text-center text-xs text-muted-foreground">
          Ensayos: {match.home === false ? `${match.triesAgainst} – ${match.triesFor}` : `${match.triesFor} – ${match.triesAgainst}`}
        </p>
      )}
      <VideoList match={match} />
      {match.report && (
        <a
          href={match.report.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          <FileText className="size-4" /> Acta del partido (PDF)
        </a>
      )}
    </div>
  );
}

const toText = (n: number | null | undefined) => (n == null ? "" : String(n));

/**
 * Editor del cuerpo técnico (pestaña "Resultado" del panel del día): rival,
 * casa/fuera, estado y marcador; vídeos por enlace; acta en PDF. Al guardar
 * se puede avisar al equipo (opcional, casilla).
 */
export function MatchResultEditor({ team, day }: { team: Team; day: TrainingDay }) {
  const { profile, firebaseUser } = useAuth();
  const match = matchOf(team, day);
  const teamname = team.teamname!;
  const fecha = day.fecha!;

  const [opponent, setOpponent] = useState(match?.opponent ?? "");
  const [home, setHome] = useState<boolean | null>(match?.home ?? null);
  const [status, setStatus] = useState<MatchStatus>(match?.status ?? "pending");
  const [pf, setPf] = useState(toText(match?.pointsFor));
  const [pa, setPa] = useState(toText(match?.pointsAgainst));
  const [tf, setTf] = useState(toText(match?.triesFor));
  const [ta, setTa] = useState(toText(match?.triesAgainst));
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    const scores = [pf, pa, tf, ta].map(parseScore);
    if (scores.includes("invalid")) {
      toast.error("Los puntos y ensayos tienen que ser números enteros");
      return;
    }
    const [pointsFor, pointsAgainst, triesFor, triesAgainst] = scores as (number | null)[];
    if (status === "played" && (pointsFor == null || pointsAgainst == null)) {
      toast.error("Pon los puntos de los dos equipos (o cambia el estado a «Sin jugar»)");
      return;
    }
    setSaving(true);
    try {
      const input = { opponent, home, status, pointsFor, pointsAgainst, triesFor, triesAgainst };
      await saveMatchResult(teamname, fecha, input);
      let description: string | undefined;
      if (notify) {
        const outcome = matchOutcome({ ...input, videos: {} } as Match);
        const rival = opponent.trim() ? ` contra ${opponent.trim()}` : "";
        const summary =
          status === "played" && outcome
            ? `${MATCH_OUTCOME_LABEL[outcome]} ${pointsFor} – ${pointsAgainst}${rival}`
            : status === "abandoned"
              ? `Partido${rival} suspendido`
              : `Partido${rival} actualizado`;
        const recipients = [...new Set([...Object.keys(team.userplayers), ...Object.keys(team.coaches)])].filter(
          (uid) => uid !== firebaseUser?.uid,
        );
        const { sent } = await sendMatchResultNotification({
          teamName: teamname,
          trainingDate: fecha,
          recipientUserIds: recipients,
          summary,
          senderUserId: firebaseUser?.uid ?? "",
          senderUsername: profile?.username ?? "",
        });
        description = `Aviso enviado: ${sent} lo reciben en el móvil; el resto lo verá en sus avisos.`;
        setNotify(false);
      }
      toast.success("Resultado guardado", { description });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el resultado");
    } finally {
      setSaving(false);
    }
  };

  const addVideo = async () => {
    setAddingVideo(true);
    try {
      await addMatchVideo(teamname, fecha, { url: videoUrl, title: videoTitle });
      setVideoUrl("");
      setVideoTitle("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo añadir el vídeo");
    } finally {
      setAddingVideo(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("El acta tiene que ser un PDF");
      return;
    }
    if (file.size >= MATCH_REPORT_MAX_BYTES) {
      toast.error("El PDF pesa más de 10 MB");
      return;
    }
    setUploading(true);
    try {
      await uploadMatchReport(teamname, fecha, file);
      toast.success("Acta subida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el acta");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`rival-${fecha}`} className="text-xs text-muted-foreground">
            Rival
          </Label>
          <Input
            id={`rival-${fecha}`}
            value={opponent}
            maxLength={80}
            placeholder="p. ej. Leones RC"
            disabled={saving}
            onChange={(e) => setOpponent(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Casa o fuera"
            value={home == null ? null : home ? "home" : "away"}
            options={[
              { value: "home", label: "En casa" },
              { value: "away", label: "Fuera" },
            ]}
            onChange={(v) => setHome(v === "home")}
            disabled={saving}
          />
          <Segmented
            label="Estado del partido"
            value={status}
            options={MATCH_STATUSES.map((s) => ({ value: s, label: MATCH_STATUS_LABEL[s] }))}
            onChange={setStatus}
            disabled={saving}
          />
        </div>
        {status === "played" && (
          <div className="flex flex-wrap gap-6">
            <ScorePair label="Puntos (nosotros – rival)" ours={pf} theirs={pa} onOurs={setPf} onTheirs={setPa} disabled={saving} />
            <ScorePair label="Ensayos (opcional)" ours={tf} theirs={ta} onOurs={setTf} onTheirs={setTa} disabled={saving} />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            disabled={saving}
            onChange={(e) => setNotify(e.target.checked)}
            className="size-4 accent-primary"
          />
          Avisar al equipo al guardar
        </label>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? "Guardando…" : notify ? "Guardar y avisar" : "Guardar resultado"}
        </Button>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Vídeos</p>
        {match && (
          <VideoList
            match={match}
            onRemove={(id) =>
              void removeMatchVideo(teamname, fecha, id).catch((e) =>
                toast.error(e instanceof Error ? e.message : "No se pudo quitar el vídeo"),
              )
            }
          />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={videoUrl}
            placeholder="Enlace (YouTube, Vimeo, Drive…)"
            aria-label="Enlace del vídeo"
            inputMode="url"
            disabled={addingVideo}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="sm:flex-[2]"
          />
          <Input
            value={videoTitle}
            maxLength={80}
            placeholder="Título (opcional)"
            aria-label="Título del vídeo"
            disabled={addingVideo}
            onChange={(e) => setVideoTitle(e.target.value)}
            className="sm:flex-1"
          />
          <Button variant="outline" disabled={addingVideo || !videoUrl.trim()} onClick={() => void addVideo()}>
            Añadir
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Acta</p>
        {match?.report ? (
          <div className="flex items-center gap-2">
            <a
              href={match.report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-brand hover:underline"
            >
              <FileText className="size-4 shrink-0" />
              <span className="truncate">{match.report.name || "Acta del partido.pdf"}</span>
            </a>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Quitar acta"
              disabled={uploading}
              onClick={() =>
                void removeMatchReport(teamname, fecha).catch((e) =>
                  toast.error(e instanceof Error ? e.message : "No se pudo quitar el acta"),
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sube el acta en PDF (máx. 10 MB). La verá todo el equipo.</p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <Upload className="size-3.5" />
          {uploading ? "Subiendo…" : match?.report ? "Sustituir acta" : "Subir acta"}
        </Button>
      </section>
    </div>
  );
}
