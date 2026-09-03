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
 * `clubId` explícito (panel admin, ver un club ajeno; o el clubId — quizá
 * `null` — de un equipo concreto en TeamManager) sustituye a ambos — las
 * reglas RTDB ya dan lectura total de cualquier club a un ADMIN. Se
 * distingue `undefined` (parámetro OMITIDO del todo → resolver "mi propio
 * club") de `null` (parámetro pasado explícitamente, p.ej. team.clubId de
 * un equipo sin club → no hay nada que cargar, sin caer al fallback de "mi
 * propio club", que sería un club completamente distinto y equivocado).
 */
export function useClub(clubId?: string | null) {
  const { profile } = useAuth();
  const uid = profile?.userId ?? null;
  const pointerClubId = profile?.directorOfClubId ?? null;
  const explicit = clubId !== undefined;
  const resolvedClubId = explicit ? clubId : pointerClubId;
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
    // clubId explícito (aunque sea null/vacío) — nada que suscribir aquí;
    // el resultado final ("sin club") se deriva más abajo sin pasar por
    // este estado, para no llamar a setState síncronamente en el efecto.
    if (explicit) return;
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
  }, [resolvedClubId, uid, explicit]);

  // clubId explícito sin valor (p.ej. team.clubId===null): nada que cargar,
  // "sin club" es un hecho conocido de antemano, no un resultado async.
  const finalClub = explicit && !resolvedClubId ? null : club;
  // club: undefined = cargando, null = no administra ninguno / sin club, Club = el resuelto
  const loading = profile === null || (Boolean(resolvedClubId || (!explicit && uid)) && finalClub === undefined);
  return { club: finalClub ?? null, loading };
}
