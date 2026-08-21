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
 * El club que ADMINISTRA el usuario actual (Clubs con adminUserId === mi
 * uid), en tiempo real — a lo sumo uno hoy (createClub/createClubAndTeam
 * siempre asignan adminUserId = el propio creador). Distinto de "el club al
 * que pertenece mi equipo" (eso es Teams/{miEquipo}/clubId, no requiere ser
 * admin de nada).
 */
export function useClub() {
  const { profile } = useAuth();
  const uid = profile?.userId ?? null;
  const [club, setClub] = useState<Club | null | undefined>(undefined);

  useEffect(() => {
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
  }, [uid]);

  // club: undefined = cargando, null = no administra ninguno, Club = el suyo
  const loading = profile === null || (Boolean(uid) && club === undefined);
  return { club: club ?? null, loading };
}
