"use client";

import { equalTo, onValue, orderByChild, query, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { ClubSchema } from "@/lib/schemas/club";
import type { Club } from "@/lib/types";

/**
 * El club que ADMINISTRA el usuario actual (fundador o co-director, ver
 * rediseño multi-director 2026-09-03), en tiempo real. Distinto de "el club
 * al que pertenece mi equipo" (eso es Teams/{miEquipo}/clubId, no requiere
 * ser director de nada).
 *
 * Descubrimiento: primero `profile.directorOfClubId` (puntero que
 * createClub/appointDirector escriben para fundador Y co-directores por
 * igual — necesario porque RTDB no permite un `orderByChild` dentro de un
 * mapa anidado como `directors/{uid}`, mismo motivo por el que un
 * co-entrenador se descubre vía `Users/{uid}/teamname`, no buscando en
 * todos los Teams). Si no hay puntero, cae al `orderByChild('adminUserId')`
 * de siempre — compatibilidad con clubes ya existentes cuyo fundador no lo
 * tiene todavía (nunca hizo falta backfill, ver plan).
 *
 * `clubId` explícito (panel admin, ver un club ajeno) sustituye a ambos —
 * las reglas RTDB ya dan lectura total de cualquier club a un ADMIN.
 */
export function useClub(clubId?: string) {
  const { profile } = useAuth();
  const uid = profile?.userId ?? null;
  const pointerClubId = profile?.directorOfClubId ?? null;
  const resolvedClubId = clubId ?? pointerClubId;
  const [club, setClub] = useState<Club | null | undefined>(undefined);

  useEffect(() => {
    if (resolvedClubId) {
      return onValue(
        ref(db, `${PATHS.CLUBS}/${resolvedClubId}`),
        (snap) => setClub(snap.exists() ? parseOr(ClubSchema, snap.val(), `Clubs/${resolvedClubId}`) : null),
        (error) => {
          console.error("useClub:", error);
          setClub(null);
        },
      );
    }
    // Sin clubId explícito ni puntero propio: fallback de compatibilidad
    // (fundadores de clubes creados antes de este puntero).
    if (!uid) return;
    return onValue(
      query(ref(db, PATHS.CLUBS), orderByChild("adminUserId"), equalTo(uid)),
      (snap) => {
        let found: Club | null = null;
        snap.forEach((child) => {
          found = parseOr(ClubSchema, child.val(), `Clubs/${child.key}`);
          return true;
        });
        setClub(found);
      },
      (error) => {
        console.error("useClub:", error);
        setClub(null);
      },
    );
  }, [resolvedClubId, uid]);

  // club: undefined = cargando, null = no administra ninguno, Club = el suyo
  const loading = profile === null || (Boolean(resolvedClubId || uid) && club === undefined);
  return { club: club ?? null, loading };
}
