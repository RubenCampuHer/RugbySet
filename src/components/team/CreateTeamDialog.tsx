"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { TeamForm } from "@/components/team/TeamForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useClub } from "@/hooks/useClub";
import { createAdditionalTeam } from "@/lib/actions/onboarding";
import { joinTeamByCode, setActiveTeam } from "@/lib/actions/team";
import { resizeAndUpload } from "@/lib/storage";

/**
 * "Crear otro equipo" desde la pestaña Equipo (varios equipos, fase 2 —
 * 2026-09-04) para un entrenador/ADMIN. Reutiliza el TeamForm del onboarding.
 * Si el usuario dirige un club (useClub() sin argumento = mi propio club),
 * puede meter el equipo nuevo en él con su categoría; nunca crea un club
 * nuevo aquí. El equipo activo no cambia si ya había uno — el toast ofrece
 * "Cambiar a X".
 */
export function CreateTeamDialog({ className }: { className?: string }) {
  const { firebaseUser, profile } = useAuth();
  const { club } = useClub();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inClub, setInClub] = useState(false);

  const coachName = profile?.nameSurname?.trim() || profile?.username?.trim() || "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className={className} />}>
        <Plus className="size-4" /> Crear otro equipo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {club && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inClub}
                disabled={busy}
                onChange={(e) => setInClub(e.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              Dentro de mi club <span className="font-medium">{club.clubname}</span>
            </label>
          )}
          <TeamForm
            submitLabel="Crear equipo"
            busy={busy}
            withCategory={Boolean(club) && inClub}
            onSubmit={async ({ name, code, iconFile, category, alsoPlayer }) => {
              if (!firebaseUser) return;
              setBusy(true);
              try {
                // Mismo control de código duplicado que el onboarding
                // (joinTeamByCode en dryRun — las reglas no dejan leer /Teams).
                const dup = await joinTeamByCode(code, true);
                if (dup.found) {
                  toast.error('Ese código ya lo usa otro equipo. Prueba "Sugerir otro" o cámbialo.');
                  return;
                }
                const iconUrl = iconFile ? await resizeAndUpload(`team_images/${name}`, iconFile) : null;
                const hadActive = Boolean(profile?.teamname);
                await createAdditionalTeam({
                  teamName: name,
                  teamCode: code,
                  iconUrl,
                  coachName,
                  uid: firebaseUser.uid,
                  alsoPlayer,
                  club: inClub ? club : null,
                  category,
                  setActive: !hadActive,
                });
                setOpen(false);
                toast.success(
                  `Equipo ${name} creado — código ${code}`,
                  hadActive
                    ? {
                        duration: 8000,
                        action: {
                          label: `Cambiar a ${name}`,
                          onClick: () => void setActiveTeam(firebaseUser.uid, name),
                        },
                      }
                    : undefined,
                );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error al crear el equipo");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
