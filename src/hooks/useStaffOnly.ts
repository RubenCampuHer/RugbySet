"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTeam } from "@/hooks/useTeam";
import { isStaffUser } from "@/lib/permissions";

/**
 * Listados de la biblioteca solo para el cuerpo técnico (2026-09-30): un
 * jugador o delegado que llega a /trainings o /exercises va al Calendario,
 * desde donde ve los entrenos y ejercicios de su equipo. Las fichas sueltas
 * siguen abiertas. Devuelve true cuando ya se sabe que puede quedarse.
 */
export function useStaffOnly(): boolean {
  const { firebaseUser, profile } = useAuth();
  const { team, loading } = useTeam();
  const router = useRouter();
  const ready = profile !== null && !loading;
  const allowed = ready && isStaffUser(profile, team, firebaseUser?.uid);
  useEffect(() => {
    if (ready && !allowed) router.replace("/calendar");
  }, [ready, allowed, router]);
  return allowed;
}
