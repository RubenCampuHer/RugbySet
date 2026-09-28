"use client";

import { get, ref } from "firebase/database";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/AvatarInitials";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { adminAddMember } from "@/lib/actions/admin";
import { addableProfiles, MEMBER_ROLE_LABEL, MEMBER_ROLES, type MemberRole } from "@/lib/admin-members";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseMap } from "@/lib/schemas/lesson";
import { PublicProfileSchema } from "@/lib/schemas/user";
import type { PublicProfile, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * ADMIN: añadir a cualquier persona al equipo (2026-09-28) sin que lo pida,
 * como jugador, co-entrenador o delegado. Busca en publicProfiles (lo puede
 * leer cualquier usuario con sesión) al abrir el diálogo.
 */
export function AddMemberDialog({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile> | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState<MemberRole>("player");
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setQuery("");
    setSelected(null);
    setRole("player");
    void get(ref(db, PATHS.PUBLIC_PROFILES))
      .then((snap) => {
        // La clave del nodo es el uid (no dependemos de que cada perfil traiga userId).
        setProfiles(parseMap(PublicProfileSchema, snap.val()) as Record<string, PublicProfile>);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "No se pudo cargar la lista de personas");
        setProfiles({});
      });
  };

  const results = profiles ? addableProfiles(profiles, team, query) : [];
  const chosen = selected && profiles ? profiles[selected] : null;

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminAddMember(team, selected, role);
      toast.success(`${chosen?.nameSurname || "La persona"} añadida a ${team.teamname} como ${MEMBER_ROLE_LABEL[role].toLowerCase()}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo añadir");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="xl" className="w-full" />}>
        <UserPlus className="size-4" /> Añadir persona al equipo
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir a {team.teamname}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre o usuario…" />
          {profiles === null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Cargando personas…</p>
          ) : results.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nadie coincide (quien ya está en el equipo no sale).</p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border">
              {results.map(({ uid, profile }) => (
                <li key={uid}>
                  <button
                    type="button"
                    onClick={() => setSelected(uid)}
                    aria-pressed={selected === uid}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50",
                      selected === uid && "bg-primary/10",
                    )}
                  >
                    <AvatarInitials name={profile.nameSurname} src={profile.usericon} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{profile.nameSurname || "Sin nombre"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{profile.username}
                        {profile.teamname ? ` · ${profile.teamname}` : " · sin equipo"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {chosen && (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Como</legend>
              <div className="flex flex-wrap gap-2">
                {MEMBER_ROLES.map((r) => (
                  <Button key={r} type="button" variant={role === r ? "default" : "outline"} onClick={() => setRole(r)}>
                    {MEMBER_ROLE_LABEL[r]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Entra directamente, sin solicitud. Si no tiene equipo activo, este pasa a serlo. Su rol en la app no cambia.
              </p>
            </fieldset>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!selected || busy} onClick={() => void add()}>
            {busy ? "Añadiendo…" : chosen ? `Añadir a ${chosen.nameSurname || "esta persona"}` : "Elige a alguien"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
