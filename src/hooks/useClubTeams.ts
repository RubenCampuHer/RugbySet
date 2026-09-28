"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { TeamSchema } from "@/lib/schemas/team";
import type { Team } from "@/lib/types";

/**
 * Equipos de un club en tiempo real (2026-09-28: avisos, calendario y
 * números del club). La dirección del club puede leerlos (regla de
 * Teams/$teamname); uno que no se puede leer (ya salió del club) se omite.
 */
export function useClubTeams(names: string[]) {
  const key = names.join("|");
  const [teams, setTeams] = useState<Record<string, Team | null>>({});

  useEffect(() => {
    if (!key) return;
    const offs = key.split("|").map((name) =>
      onValue(
        ref(db, `${PATHS.TEAMS}/${name}`),
        (snap) => setTeams((prev) => ({ ...prev, [name]: snap.exists() ? parseOr(TeamSchema, snap.val(), `Teams/${name}`) : null })),
        () => setTeams((prev) => ({ ...prev, [name]: null })),
      ),
    );
    return () => offs.forEach((off) => off());
  }, [key]);

  return useMemo(() => {
    const list = key ? key.split("|") : [];
    return {
      teams: list.map((n) => teams[n]).filter((t): t is Team => Boolean(t)),
      loading: list.some((n) => !(n in teams)),
    };
  }, [key, teams]);
}
