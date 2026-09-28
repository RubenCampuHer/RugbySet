"use client";

import { onValue, ref } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { useEffect, useRef, useState } from "react";
import { statsAreStale, type TeamStatsMap } from "@/lib/club-stats";
import { db, functions } from "@/lib/firebase";
import { ClubTeamStatsSchema } from "@/lib/schemas/club";
import { parseMap } from "@/lib/schemas/lesson";

/**
 * ClubStats/{clubId}/teams en tiempo real (2026-09-28). Si faltan equipos o
 * los números son de otro día, pide una vez a la Cloud Function
 * refreshClubStats que recalcule el club (una sesión cuenta desde el día
 * siguiente y a medianoche no se escribe nada que dispare el recálculo).
 */
export function useClubStats(clubId: string | null, clubTeams: string[]) {
  const [state, setState] = useState<{ clubId: string; stats: TeamStatsMap } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!clubId) return;
    return onValue(
      ref(db, `ClubStats/${clubId}/teams`),
      (snap) => setState({ clubId, stats: parseMap(ClubTeamStatsSchema, snap.val()) }),
      (e) => setError(e.message),
    );
  }, [clubId]);

  const stats = state && state.clubId === clubId ? state.stats : null;
  const teamsKey = clubTeams.join("|");

  useEffect(() => {
    if (!clubId || !stats || asked.current === clubId) return;
    if (!statsAreStale(stats, teamsKey ? teamsKey.split("|") : [])) return;
    asked.current = clubId;
    // Aviso de "recalculando" fuera del render del efecto (no bloquea la vista).
    queueMicrotask(() => setRefreshing(true));
    httpsCallable(functions, "refreshClubStats")({ clubId })
      .catch((e: unknown) => console.error("refreshClubStats:", e))
      .finally(() => setRefreshing(false));
  }, [clubId, stats, teamsKey]);

  return { stats: stats ?? {}, loading: Boolean(clubId) && !stats && !error, refreshing, error };
}
