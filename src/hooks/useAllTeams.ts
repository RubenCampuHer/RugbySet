"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { TeamSchema } from "@/lib/schemas/team";
import type { Team } from "@/lib/types";

export type NamedTeam = { name: string; team: Team };

/**
 * TODOS los equipos, en tiempo real, sin filtrar por el equipo propio — solo
 * para el panel admin (las reglas RTDB ya dan lectura completa de Teams a
 * ADMIN; este hook no comprueba el rol, hazlo en la página que lo use).
 * Mismo patrón que useExercises/useTrainings, sin el filtrado de visibilidad.
 */
export function useAllTeams() {
  const [teams, setTeams] = useState<NamedTeam[] | null>(null);

  useEffect(() => {
    return onValue(
      ref(db, PATHS.TEAMS),
      (snap) => {
        const entries: NamedTeam[] = [];
        snap.forEach((child) => {
          const team = child.key ? parseOr(TeamSchema, child.val(), `Teams/${child.key}`) : null;
          if (child.key && team) {
            entries.push({ name: child.key, team });
          }
          return false;
        });
        setTeams(entries);
      },
      (error) => {
        console.error("useAllTeams:", error);
        setTeams([]);
      },
    );
  }, []);

  return { teams: teams ?? [], loading: teams === null };
}
