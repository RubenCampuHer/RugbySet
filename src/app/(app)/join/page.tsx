"use client";

import { LinkIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { JoinTeamForm } from "@/components/team/JoinTeamForm";

/**
 * Invitación a un equipo por enlace (/join?code=…, 2026-09-25). Siempre como
 * jugador: a co-entrenador solo asciende el entrenador.
 * Sin sesión, el layout manda a login/onboarding con ?next= y vuelve aquí.
 * Reutiliza JoinTeamForm (dryRun para previsualizar + solicitud real): el
 * enlace no salta la aprobación del entrenador.
 */
function JoinContent() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code")?.trim() || null;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Invitación a un equipo" />
      {code ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Te han invitado a un equipo. Revisa que es el tuyo y envía tu solicitud.
          </p>
          <JoinTeamForm initialCode={code} onJoined={() => router.replace("/team")} />
        </div>
      ) : (
        <EmptyState icon={LinkIcon} title="Enlace no válido" hint="Pide a tu entrenador que te vuelva a enviar la invitación." />
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinContent />
    </Suspense>
  );
}
