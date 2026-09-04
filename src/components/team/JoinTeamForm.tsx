"use client";

import { useState } from "react";
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
 */
export function JoinTeamForm({ onJoined }: { onJoined?: () => void }) {
  const { firebaseUser } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ teamname: string; teamicon: string | null } | null>(null);

  const search = async () => {
    const trimmed = code.trim();
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

  const join = async () => {
    setBusy(true);
    try {
      const result = await joinTeamByCode(code.trim(), false);
      if (!result.found) {
        toast.error("Código no encontrado");
        return;
      }
      const message =
        result.status === "joined"
          ? `Te has unido a ${result.teamname}`
          : result.status === "already_member"
            ? `Ya eres miembro de ${result.teamname}`
            : result.status === "pending_coach"
              ? `Solicitud de co-entrenador enviada a ${result.teamname}. El entrenador debe aceptarte.`
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
            Tu entrenador deberá aceptar tu solicitud antes de que veas el equipo.
          </p>
        </div>
      )}
    </div>
  );
}
