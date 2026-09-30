"use client";

import { FileText, Folder, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { BlocksEditor } from "@/components/blocks/BlocksEditor";
import { AudiencePicker } from "@/components/audience/AudiencePicker";
import { FolderPickerDialog } from "@/components/lessons/LessonDialogs";
import { DetailSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClubLessons, useLessonsClub, usePendingLessons } from "@/hooks/useClubLessons";
import { discardUploads, newLessonId, saveLesson, uploadLessonFile } from "@/lib/actions/lessons";
import { type Audience, normalizeAudience } from "@/lib/audience";
import {
  breadcrumb,
  lessonFiles,
  parentAudience,
  sortedBlocks,
  toBlocksRecord,
  type BlockEntry,
} from "@/lib/lessons";
import { normalizeVideoUrl } from "@/lib/match";
import { canEditClubItem } from "@/lib/permissions";

function LessonEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const editingId = params.get("id");
  const initialFolder = params.get("folder");
  const { uid, clubId, club, isDirector, canWrite, loading } = useLessonsClub();
  const { folders, lessons, loading: loadingLessons } = useClubLessons(clubId);
  const { pending: pendingMap, loading: loadingPending } = usePendingLessons(clubId, uid, isDirector);

  const [lessonId, setLessonId] = useState<string | null>(editingId);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(initialFolder);
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  /** Público propio (null = el de la carpeta). */
  const [ownAudience, setOwnAudience] = useState<Audience | null>(null);
  /** Ficheros subidos en esta sesión del editor (para borrarlos si no se guardan). */
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [pickFolder, setPickFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Subidas en curso (bloquean guardar). */
  const [busy, setBusy] = useState(0);

  const approved = editingId ? (lessons[editingId] ?? null) : null;
  const pending = editingId ? (pendingMap[editingId] ?? null) : null;
  const source = pending ?? approved;
  const ready = !loading && !loadingLessons && !loadingPending && Boolean(clubId);

  // Carga inicial (una vez): la versión pendiente si la hay, si no la publicada. Ajuste en render, sin efecto.
  if (ready && !loaded && (!editingId || source)) {
    setLoaded(true);
    if (source) {
      setTitle(source.title);
      setFolderId(source.folderId ?? null);
      setBlocks(sortedBlocks(source));
      setOwnAudience(source.audienceInherited === false ? (source.audience ?? null) : null);
    }
  }
  if (ready && clubId && !lessonId) setLessonId(newLessonId(clubId));

  if (!ready || (editingId && !loaded && !source && loadingLessons)) return <DetailSkeleton />;
  if (!canWrite || (source && !canEditClubItem(source, uid, isDirector, canWrite))) {
    return (
      <EmptyState
        icon={Lock}
        title="No puedes editar esta lección"
        hint="Crean lecciones la dirección y los entrenadores del club; cada entrenador edita las suyas."
      />
    );
  }
  if (editingId && !source) {
    return <EmptyState icon={FileText} title="Lección no encontrada" />;
  }

  const path = breadcrumb(folders, folderId);
  const save = async () => {
    if (!clubId || !lessonId || !uid) return;
    if (!title.trim()) {
      toast.error("Ponle un título a la lección");
      return;
    }
    // Enlaces de vídeo: solo http(s); los vacíos se quitan.
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
    const own = ownAudience ? normalizeAudience(ownAudience) : null;
    if (ownAudience && !own) {
      toast.error("Elige al menos un equipo para el público de la lección");
      return;
    }
    setSaving(true);
    try {
      const draft = { title, folderId, blocks: toBlocksRecord(cleaned), ownAudience: own };
      const ctx = { folders, lessons, pending: pendingMap, uid, isDirector };
      const result = await saveLesson({ clubId, lessonId, ctx, draft, approved, pending });
      // Lo subido aquí que al final no quedó en la lección.
      const used = new Set(lessonFiles(draft));
      await discardUploads(uploaded.filter((p) => !used.has(p)));
      toast.success(result === "published" ? "Lección publicada" : "Enviada a la dirección del club para aprobar");
      router.replace(`/club/lessons/detail?id=${encodeURIComponent(lessonId)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la lección");
      setSaving(false);
    }
  };

  const cancel = async () => {
    await discardUploads(uploaded);
    router.back();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <BackLink href="/club/lessons" label="Lecciones" />
      <h1 className="text-2xl font-bold">{editingId ? "Editar lección" : "Nueva lección"}</h1>
      {!isDirector && (
        <p className="text-sm text-muted-foreground">
          Al guardar, la lección pasa a la dirección del club para que la apruebe.
          {approved ? " Mientras tanto el club sigue viendo la versión publicada." : ""}
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="lesson-title">Título</Label>
        <Input id="lesson-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>Carpeta</Label>
        <Button variant="outline" className="w-full justify-start" onClick={() => setPickFolder(true)}>
          <Folder /> <span className="truncate">{path.length ? path.map((c) => c.name).join(" / ") : "Lecciones (inicio)"}</span>
        </Button>
      </div>

      <Card>
        <CardContent className="py-3">
          <AudiencePicker
            value={ownAudience}
            onChange={setOwnAudience}
            teams={club?.teams ?? []}
            inherited={parentAudience(folders, folderId)}
          />
        </CardContent>
      </Card>

      <BlocksEditor
        blocks={blocks}
        setBlocks={setBlocks}
        addLabel="Añadir a la lección"
        showPrivacyHint
        upload={(kind, file, onProgress) => uploadLessonFile(clubId!, lessonId!, kind, file, onProgress)}
        onUploaded={(path) => setUploaded((list) => [...list, path])}
        onBusyChange={(b) => setBusy((n) => n + (b ? 1 : -1))}
      />

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-2xl justify-end gap-2">
          <Button variant="outline" size="xl" disabled={saving} onClick={() => void cancel()}>
            Cancelar
          </Button>
          <Button size="xl" disabled={saving || busy > 0} onClick={() => void save()}>
            {saving ? "Guardando…" : isDirector ? "Publicar" : "Enviar para aprobar"}
          </Button>
        </div>
      </div>

      <FolderPickerDialog
        open={pickFolder}
        onOpenChange={setPickFolder}
        title="Guardar en…"
        folders={folders}
        current={folderId}
        onPick={(id) => setFolderId(id)}
      />
    </div>
  );
}

export default function LessonEditPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LessonEditor />
    </Suspense>
  );
}
