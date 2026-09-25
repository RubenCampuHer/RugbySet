"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinTeamByCode, setActiveTeam } from "@/lib/actions/team";

/**
 * Formulario de ingreso por código para quien todavía no tiene equipo.
 * Usa la Cloud Function joinTeamByCode (dryRun para previsualizar, luego la
 * solicitud real) — las reglas no permiten a un no-miembro leer /Teams ni
 * escribir pendingplayers de forma segura desde el cliente.
 *
 * Extraído de team/page.tsx para reutilizarlo también en el wizard de
 * onboarding (rama Jugador, mirror de SetupJoinTeamFragment en Android).
 *
 * Siempre se entra como JUGADOR (decisión 2026-09-25): nadie se ofrece como
 * co-entrenador; el entrenador asciende a quien quiera (promoteToCoach). Se
 * manda as: "player" explícito porque joinTeamByCode, sin él, hace entrar
 * como co-entrenador a las cuentas COACH.
 */
export function JoinTeamForm({
  onJoined,
  initialCode,
}: {
  onJoined?: () => void;
  /** Enlace de invitación (/join?code=, 2026-09-25): se rellena y se busca solo. */
  initialCode?: string | null;
}) {
  const { firebaseUser, profile } = useAuth();
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ teamname: string; teamicon: string | null } | null>(null);

  const search = async (value = code) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    setPreview(null);
    try {
      const result = await joinTeamByCode(trimmed, true);
      if (!result.found) {
        toast.error("Código no encontrado");
        return;
      }
      setPreview({ teamname: result.teamname!, teamicon: result.teamicon ?? null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al buscar el equipo");
    } finally {
      setBusy(false);
    }
  };

  // Enlace de invitación: previsualizar el equipo sin que el usuario pulse "Buscar".
  const autoSearched = useRef(false);
  useEffect(() => {
    if (!initialCode || autoSearched.current || !firebaseUser) return;
    autoSearched.current = true;
    void search(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez, al tener sesión
  }, [initialCode, firebaseUser]);

  const join = async () => {
    setBusy(true);
    try {
      const result = await joinTeamByCode(code.trim(), false, "player");
      if (!result.found) {
        toast.error("Código no encontrado");
        return;
      }
      const message =
        result.status === "joined"
          ? `Te has unido a ${result.teamname}`
          : result.status === "already_member"
            ? `Ya eres miembro de ${result.teamname}`
            : `Solicitud enviada a ${result.teamname}. Tu entrenador debe aceptarte.`;
      // Varios equipos (fase 2): entrar en otro equipo no cambia el activo —
      // se ofrece cambiar desde el propio aviso.
      const teamname = result.teamname;
      const offerSwitch =
        result.status === "joined" && result.activeChanged === false && firebaseUser && teamname;
      toast.success(
        message,
        offerSwitch
          ? {
              duration: 8000,
              action: {
                label: `Cambiar a ${teamname}`,
                onClick: () => void setActiveTeam(firebaseUser.uid, teamname),
              },
            }
          : undefined,
      );
      onJoined?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-lg border p-4">
      <div className="flex gap-2">
        <Input
          value={code}
          placeholder="Código del equipo"
          onChange={(e) => { setCode(e.target.value); setPreview(null); }}
          onKeyDown={(e) => e.key === "Enter" && void search()}
        />
        <Button variant="outline" disabled={busy || !code.trim()} onClick={() => void search()}>
          Buscar
        </Button>
      </div>
      {preview && (
        <div className="space-y-1.5 rounded-md bg-muted p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AvatarInitials name={preview.teamname} src={preview.teamicon} size="sm" />
              <span className="text-sm font-medium">{preview.teamname}</span>
            </div>
            <Button size="sm" disabled={busy} onClick={() => void join()}>
              Solicitar ingreso
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {profile?.role === "ADMIN"
              ? "Como administrador entras directamente, sin aprobación."
              : "Entras como jugador: tu entrenador deberá aceptarte y, si quiere, te hará co-entrenador."}
          </p>
        </div>
      )}
    </div>
  );
}
