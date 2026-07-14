"use client";

import { onValue, ref } from "firebase/database";
import { Lock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRole } from "@/lib/actions/admin";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { getRoleDisplayName, isAdmin } from "@/lib/permissions";
import { parseMapOr } from "@/lib/schemas/common";
import { PublicProfileSchema } from "@/lib/schemas/user";
import type { PublicProfile, Role } from "@/lib/types";

const ROLES: Role[] = ["PLAYER", "COACH", "ADMIN"];

/** Espejo de la pantalla de gestión de roles que no existía en la web —
 * updateUserRole (admin.ts) ya estaba escrita pero sin ningún caller. */
export default function AdminUsersPage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    return onValue(
      ref(db, PATHS.PUBLIC_PROFILES),
      (snap) => setProfiles(parseMapOr(PublicProfileSchema, snap.val(), "publicProfiles")),
      (error) => {
        console.error("AdminUsersPage:", error);
        setProfiles([]);
      },
    );
  }, []);

  if (profile === null || profiles === null) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para gestionar usuarios."
      />
    );
  }

  const filtered = profiles
    .filter((p) => p.userId)
    .filter(
      (p) =>
        search === "" ||
        (p.nameSurname ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.username ?? "").toLowerCase().includes(search.toLowerCase()),
    );

  const changeRole = async (uid: string, role: Role) => {
    setBusy(uid);
    try {
      await updateUserRole(uid, role);
      toast.success("Rol actualizado");
    } catch {
      toast.error("No se pudo actualizar el rol");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Gestionar usuarios" count={profiles.length} />
      <SearchInput
        placeholder="Buscar por nombre o usuario…"
        value={search}
        onChange={setSearch}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin resultados" />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const uid = p.userId!;
            const isSelf = uid === profile.userId;
            return (
              <Card key={uid}>
                <CardContent className="flex items-center gap-3 py-3">
                  <AvatarInitials name={p.nameSurname} src={p.usericon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {p.nameSurname ?? p.username ?? "(sin nombre)"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {p.username && `@${p.username}`}
                      {p.teamname && ` · ${p.teamname}`}
                    </p>
                  </div>
                  <Select
                    value={p.role}
                    disabled={isSelf || busy === uid}
                    onValueChange={(v) => void changeRole(uid, v as Role)}
                  >
                    <SelectTrigger aria-label={`Rol de ${p.nameSurname ?? p.username}`}>
                      <SelectValue>{getRoleDisplayName(p.role)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleDisplayName(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
