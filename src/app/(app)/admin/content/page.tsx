"use client";

import { Lock, SearchX } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
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
import { useAllContent } from "@/hooks/useAllContent";
import { isAdmin } from "@/lib/permissions";

type Kind = "all" | "exercise" | "training";

type Row = {
  kind: "exercise" | "training";
  name: string;
  author: string | null | undefined;
  desc: string | null | undefined;
  privacy: string | null | undefined;
  approvalStatus: string | null | undefined;
  teamname: string | null | undefined;
};

export default function AdminContentPage() {
  const { profile } = useAuth();
  const { exercises, trainings, loading } = useAllContent();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para ver todo el contenido."
      />
    );
  }

  const rows: Row[] = [
    ...exercises
      .filter((e) => e.name)
      .map((e) => ({
        kind: "exercise" as const,
        name: e.name!,
        author: e.author,
        desc: e.descCorta,
        privacy: e.privacy,
        approvalStatus: e.approvalStatus,
        teamname: e.teamname,
      })),
    ...trainings
      .filter((t) => t.name)
      .map((t) => ({
        kind: "training" as const,
        name: t.name!,
        author: t.author,
        desc: t.descCorta,
        privacy: t.privacy,
        approvalStatus: t.approvalStatus,
        teamname: t.teamname,
      })),
  ];

  const filtered = rows.filter((r) => {
    const matchesKind = kind === "all" || r.kind === kind;
    const matchesSearch =
      search === "" ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.author ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesKind && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Todo el contenido" count={rows.length} />
      <p className="text-sm text-muted-foreground">
        Incluye contenido Privado y de Equipo de terceros — esta vista es solo
        de administración, no cambia lo que ves en /ejercicios ni /entrenos.
      </p>
      <div className="flex gap-2">
        <SearchInput
          className="flex-1"
          placeholder="Buscar por nombre o autor…"
          value={search}
          onChange={setSearch}
        />
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="w-36" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo</SelectItem>
            <SelectItem value="exercise">Ejercicios</SelectItem>
            <SelectItem value="training">Entrenos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Sin resultados" />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={`${r.kind}-${r.name}`}>
              <CardContent className="space-y-1.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{r.name}</p>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    <PrivacyBadge privacy={r.privacy} />
                    <ApprovalBadge status={r.approvalStatus} />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.kind === "exercise" ? "Ejercicio" : "Entreno"}
                  {r.author && ` · de ${r.author}`}
                  {r.teamname && ` · ${r.teamname}`}
                </p>
                {r.desc && <p className="text-sm">{r.desc}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
