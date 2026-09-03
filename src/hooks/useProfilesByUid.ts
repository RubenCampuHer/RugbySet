"use client";

import { get, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { PublicProfileSchema } from "@/lib/schemas/user";
import type { PublicProfile } from "@/lib/types";

/**
 * Perfil público de cada uid (entrenadores/directores, guardados por uid a
 * diferencia de userplayers) — lectura puntual, no en tiempo real. Extraído
 * de TeamManager.tsx (CoachesSection) para reutilizarlo también en
 * ClubManager.tsx (sección "Directores").
 */
export function useProfilesByUid(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, PublicProfile | null>>({});
  const key = uids.slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      uids.map(async (uid) => {
        const snap = await get(ref(db, `${PATHS.PUBLIC_PROFILES}/${uid}`));
        const profile = snap.exists()
          ? parseOr(PublicProfileSchema, snap.val(), `publicProfiles/${uid}`)
          : null;
        return [uid, profile] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setProfiles(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key ya resume el contenido real de uids
  }, [key]);

  return profiles;
}
