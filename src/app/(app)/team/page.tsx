"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { TeamManager } from "@/components/team/TeamManager";

/** Equipo propio — TeamManager resuelve profile.teamname cuando no se le pasa uno explícito. */
export default function TeamPage() {
  const { profile } = useAuth();
  return <TeamManager teamname={profile?.teamname ?? null} />;
}
