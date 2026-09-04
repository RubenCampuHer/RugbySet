"use client";

import { Check, ChevronDown, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyTeams } from "@/hooks/useMyTeams";
import { setActiveTeam } from "@/lib/actions/team";
import { cn } from "@/lib/utils";

/**
 * Selector del equipo ACTIVO en la cabecera (varios equipos, fase 2 —
 * 2026-09-04). Solo aparece con más de un equipo en UserTeams; cambiar
 * escribe Users/{uid}/teamname y todas las pantallas (useTeam()) siguen al
 * nuevo activo en tiempo real. Android lee ese mismo campo, así que también
 * cambia allí.
 */
export function TeamSwitcher({ className }: { className?: string }) {
  const { firebaseUser, profile } = useAuth();
  const { teams } = useMyTeams();
  const [switching, setSwitching] = useState(false);
  const active = profile?.teamname ?? null;

  if (!firebaseUser || teams.length < 2) return null;

  const choose = async (teamname: string) => {
    if (teamname === active) return;
    setSwitching(true);
    try {
      await setActiveTeam(firebaseUser.uid, teamname);
      toast.success(`Ahora estás en ${teamname}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar de equipo");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Cambiar de equipo"
        disabled={switching}
        className={cn(
          "inline-flex min-h-9 max-w-[11rem] items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
          className,
        )}
      >
        <Users className="size-3.5 shrink-0" />
        <span className="truncate">{active ?? "Elige equipo"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuLabel>Mis equipos</DropdownMenuLabel>
        {teams.map((t) => (
          <DropdownMenuItem key={t} onClick={() => void choose(t)}>
            <span className="truncate">{t}</span>
            {t === active && <Check className="ml-auto size-4 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
