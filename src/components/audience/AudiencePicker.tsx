"use client";

import { Users } from "lucide-react";
import {
  AUDIENCE_HINT,
  AUDIENCE_KINDS,
  AUDIENCE_LABEL,
  type Audience,
  type AudienceKind,
  audienceBadge,
  needsTeams,
  teamsOf,
} from "@/lib/audience";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Quién ve un contenido del club (2026-09-28). `value` null = hereda
 * (`inherited`, el público de su carpeta). Con "equipos concretos" o "cuerpo
 * técnico de equipos concretos" se eligen los equipos del club.
 */
export function AudiencePicker({
  value,
  onChange,
  teams,
  inherited,
  inheritLabel = "Igual que la carpeta",
  disabled,
}: {
  value: Audience | null;
  onChange: (value: Audience | null) => void;
  teams: string[];
  /** Público que se aplicaría heredando; sin él no se ofrece heredar. */
  inherited?: Audience | null;
  inheritLabel?: string;
  disabled?: boolean;
}) {
  const current: AudienceKind | "inherit" = value ? value.kind : inherited !== undefined ? "inherit" : "club";
  const selectedTeams = new Set(teamsOf(value));

  const pickKind = (kind: AudienceKind | "inherit") => {
    if (kind === "inherit") return onChange(null);
    // Al pasar entre los dos tipos con equipos se conservan los elegidos.
    onChange({ kind, teams: needsTeams(kind) ? (value?.teams ?? null) : null });
  };
  const toggleTeam = (team: string) => {
    const next = new Set(selectedTeams);
    if (next.has(team)) next.delete(team);
    else next.add(team);
    onChange({ kind: value!.kind, teams: next.size ? Object.fromEntries([...next].map((t) => [t, true as const])) : null });
  };

  const option = (kind: AudienceKind | "inherit", label: string, hint: string) => (
    <label
      key={kind}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50",
        current === kind && "bg-muted/50",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="radio"
        name="audience"
        className="mt-1 size-4 accent-primary"
        checked={current === kind}
        disabled={disabled}
        onChange={() => pickKind(kind)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 flex items-center gap-1 text-sm font-medium">
        <Users className="size-4" /> Quién lo ve
      </legend>
      {inherited !== undefined &&
        option(
          "inherit",
          inheritLabel,
          inherited ? `Ahora: ${audienceBadge(inherited) ?? AUDIENCE_LABEL.club}. Si cambia la carpeta, cambia con ella.` : AUDIENCE_HINT.club,
        )}
      {AUDIENCE_KINDS.map((kind) => option(kind, AUDIENCE_LABEL[kind], AUDIENCE_HINT[kind]))}
      {value && needsTeams(value.kind) && (
        <div className="space-y-1 pl-9">
          {teams.length === 0 ? (
            <p className="text-xs text-muted-foreground">El club no tiene equipos todavía.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <label key={team} className="cursor-pointer">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={selectedTeams.has(team)}
                    disabled={disabled}
                    onChange={() => toggleTeam(team)}
                  />
                  <Badge
                    variant={selectedTeams.has(team) ? "default" : "outline"}
                    className="min-h-8 px-3 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                  >
                    {team}
                  </Badge>
                </label>
              ))}
            </div>
          )}
          {selectedTeams.size === 0 && <p className="text-xs text-destructive">Elige al menos un equipo.</p>}
        </div>
      )}
    </fieldset>
  );
}

/** Etiqueta del público para filas y cabeceras; nada si es todo el club. */
export function AudienceBadge({ audience, className }: { audience: Audience | null | undefined; className?: string }) {
  const label = audienceBadge(audience);
  if (!label) return null;
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1", className)}>
      <Users className="size-3" />
      {label}
    </Badge>
  );
}
