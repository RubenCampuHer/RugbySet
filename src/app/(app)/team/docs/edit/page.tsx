"use client";

import { FileText, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/BackLink";
import { BlocksEditor } from "@/components/blocks/BlocksEditor";
import { EmptyState } from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/skeletons";
import { SpacePicker } from "@/components/team-docs/TeamDocsUi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeamDocs, useTeamDocsAccess } from "@/hooks/useTeamDocs";
import { deleteTeamFiles, newTeamDocId, saveTeamDoc, uploadTeamFile } from "@/lib/actions/team-docs";
import { type BlockEntry, sortedBlocks, toBlocksRecord } from "@/lib/lessons";
import { normalizeVideoUrl } from "@/lib/match";
import type { TeamDocSpace } from "@/lib/schemas/team-docs";
import { allowedSpaces, breadcrumbOf, teamDocsHref, validateTeamFile } from "@/lib/team-docs";

/** Crear o editar un documento del equipo (2026-09-30). */
function TeamDocEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const teamParam = params.get("team");
  const editingId = params.get("id");
  const initialFolder = params.get("folder");
  const access = useTeamDocsAccess(teamParam);
  const teamname = access.team?.teamname ?? null;
  const { docs: m, loading } = useTeamDocs(teamname, access.canRead, access.canSeeStaff);

  const [docId, setDocId] = useState<string | null>(editingId);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [space, setSpace] = useState<TeamDocSpace | null>(null);
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [busy, setBusy] = useState(0);
  const [saving, setSaving] = useState(false);

  const ready = !access.loading && !loading && Boolean(teamname);
  const previous = editingId ? (m.docs[editingId] ?? null) : null;
  const folderId = previous
    ? previous.item.folderId && m.folders[previous.item.folderId]
      ? previous.item.folderId
      : null
    : initialFolder && m.folders[initialFolder]
      ? initialFolder
      : null;
  const allowed = ready ? allowedSpaces(m, folderId) : (["team", "staff"] as TeamDocSpace[]);

  // Carga inicial (una vez), ajuste en render sin efecto.
  if (ready && !loaded && (!editingId || previous)) {
    setLoaded(true);
    if (previous) {
      setTitle(previous.item.title);
      setBlocks(sortedBlocks(previous.item));
      setSpace(previous.space);
    } else {
      setSpace(allowed[0]);
    }
  }
  if (ready && teamname && !docId) setDocId(newTeamDocId(teamname));

  if (!ready) return <DetailSkeleton />;
  if (!access.canEdit || !teamname) {
    return (
      <EmptyState
        icon={Lock}
        title="No puedes editar documentos de este equipo"
        hint="Crean y editan documentos los entrenadores y delegados del equipo."
      />
    );
  }
  if (editingId && !previous) return <EmptyState icon={FileText} title="Documento no encontrado" />;

  const back = previous ? `/team/docs/doc?${new URLSearchParams({ ...(teamParam ? { team: teamParam } : {}), id: editingId! })}` : teamDocsHref(teamParam, folderId);
  const path = breadcrumbOf(m, folderId);

  const save = async () => {
    if (!docId || !space) return;
    if (!title.trim()) {
      toast.error("Ponle un título al documento");
      return;
    }
    // Enlaces de vídeo: solo http(s); los vacíos y los textos vacíos se quitan.
    const cleaned: BlockEntry[] = [];
    for (const entry of blocks) {
      const b = entry.block;
      if (b.type === "video" && b.source === "link") {
        if (!b.url.trim()) continue;
        const url = normalizeVideoUrl(b.url);
        if (!url) {
          toast.error("Hay un enlace de vídeo que no es válido (tiene que empezar por https://)");
          return;
        }
        cleaned.push({ ...entry, block: { ...b, url, title: b.title?.trim() || null } });
      } else if (b.type === "text") {
        if (b.text.trim()) cleaned.push(entry);
      } else cleaned.push(entry);
    }
    setSaving(true);
    try {
      await saveTeamDoc({
        teamname,
        id: docId,
        space: allowed.includes(space) ? space : "staff",
        draft: { title, folderId, blocks: toBlocksRecord(cleaned) },
        previous: previous ? { space: previous.space, doc: previous.item } : null,
        uploadedInEditor: uploaded,
      });
      toast.success("Documento guardado");
      router.replace(`/team/docs/doc?${new URLSearchParams({ ...(teamParam ? { team: teamParam } : {}), id: docId })}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el documento");
      setSaving(false);
    }
  };

  const cancel = async () => {
    await deleteTeamFiles(uploaded);
    router.replace(back);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <BackLink href={back} label={previous ? previous.item.title : path.length ? path[path.length - 1].name : "Documentos"} />
      <h1 className="text-2xl font-bold">{previous ? "Editar documento" : "Nuevo documento"}</h1>
      {path.length > 0 && <p className="text-sm text-muted-foreground">En {path.map((c) => c.name).join(" / ")}</p>}

      <div className="space-y-1">
        <Label htmlFor="team-doc-title">Título</Label>
        <Input id="team-doc-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <Card>
        <CardContent className="py-3">
          <SpacePicker value={space ?? allowed[0]} onChange={setSpace} allowed={allowed} disabled={saving} />
        </CardContent>
      </Card>

      <BlocksEditor
        blocks={blocks}
        setBlocks={setBlocks}
        addLabel="Añadir al documento"
        upload={async (kind, file, onProgress) => {
          const error = validateTeamFile(file);
          if (error) throw new Error(error);
          const up = await uploadTeamFile(teamname, file, onProgress);
          return { url: up.url, path: up.path, name: up.name, size: up.size };
        }}
        onUploaded={(p) => setUploaded((list) => [...list, p])}
        onBusyChange={(b) => setBusy((n) => n + (b ? 1 : -1))}
      />

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-2xl justify-end gap-2">
          <Button variant="outline" size="xl" disabled={saving} onClick={() => void cancel()}>
            Cancelar
          </Button>
          <Button size="xl" disabled={saving || busy > 0} onClick={() => void save()}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TeamDocEditPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <TeamDocEditor />
    </Suspense>
  );
}
