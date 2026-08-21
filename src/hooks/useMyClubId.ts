"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";

/**
 * El clubId del equipo del usuario actual (Teams/{miEquipo}/clubId), en
 * tiempo real — "el club del que soy MIEMBRO" (a través de mi equipo), no
 * el que administro (eso es useClub()). Mismo patrón encadenado que
 * useTeam(): sigue profile.teamname y ese equipo puede no tener club.
 */
export function useMyClubId() {
  const { profile } = useAuth();
  const teamname = profile?.teamname ?? null;
  const [teamState, setTeamState] = useState<{ teamname: string; clubId: string | null } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!teamname) return;
    return onValue(
      ref(db, `${PATHS.TEAMS}/${teamname}/clubId`),
      (snap) => setTeamState({ teamname, clubId: snap.exists() ? (snap.val() as string) : null }),
      (error) => {
        console.error("useMyClubId:", error);
        setTeamState({ teamname, clubId: null });
      },
    );
  }, [teamname]);

  // Sin equipo: sin club, derivado (no seteado) — igual que useTeam().
  const clubId = !teamname ? null : teamState?.teamname === teamname ? teamState.clubId : undefined;
  // undefined = cargando, null = sin club, string = clubId
  const loading = profile === null || clubId === undefined;
  return { clubId: clubId ?? null, loading };
}
