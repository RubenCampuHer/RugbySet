"use client";

import {
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/BackLink";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FolderPickerDialog } from "@/components/lessons/LessonDialogs";
import { ListRowsSkeleton } from "@/components/skeletons";
import { FileKindIcon, NameDialog, SpacePicker, StaffBadge } from "@/components/team-docs/TeamDocsUi";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import { useTeamDocs, useTeamDocsAccess } from "@/hooks/useTeamDocs";
import {
  addTeamFile,
  createTeamFolder,
  deleteTeamDoc,
  deleteTeamFile,
  deleteTeamFolder,
  moveTeamDocItem,
  renameTeamFile,
  renameTeamFolder,
  setTeamDocSpace,
  uploadTeamFile,
} from "@/lib/actions/team-docs";
import type { Folders } from "@/lib/lessons";
import type { TeamDocSpace } from "@/lib/schemas/team-docs";
import {
  allowedSpaces,
  breadcrumbOf,
  canMoveFolderTo,
  contentsOf,
  countIn,
  fileKind,
  formatBytes,
  type ItemKind,
  type MergedDocs,
  teamDocsHref,
  validateTeamFile,
} from "@/lib/team-docs";

type DialogState =
  | { kind: "newFolder" }
  | { kind: "upload" }
  | { kind: "rename"; item: "folder" | "file"; id: string; space: TeamDocSpace; name: string }
  | { kind: "move"; item: ItemKind; id: string; current: string | null }
  | { kind: "delete"; item: ItemKind; id: string; name: string };

function RowMenu({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label={label} />}>
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Opción de menú para cambiar quién lo ve. */
function SpaceMenuItem({
  m,
  item,
  id,
  space,
  parent,
  onChange,
}: {
  m: MergedDocs;
  item: ItemKind;
  id: string;
  space: TeamDocSpace;
  parent: string | null;
  onChange: (item: ItemKind, id: string, to: TeamDocSpace) => void;
}) {
  if (space === "staff") {
    const canOpen = allowedSpaces(m, parent).includes("team");
    return (
      <DropdownMenuItem disabled={!canOpen} onClick={() => onChange(item, id, "team")}>
        <Users /> {canOpen ? "Hacer visible para el equipo" : "Visible para el equipo (la carpeta es privada)"}
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem onClick={() => onChange(item, id, "staff")}>
      <Lock /> {item === "folder" ? "Solo cuerpo técnico (con lo de dentro)" : "Solo cuerpo técnico"}
    </DropdownMenuItem>
  );
}

/** Subir uno o varios archivos a la carpeta actual, eligiendo antes quién los ve. */
function UploadDialog({
  open,
  onOpenChange,
  teamname,
  folderId,
  allowed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamname: string;
  folderId: string | null;
  allowed: TeamDocSpace[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [space, setSpace] = useState<TeamDocSpace>(allowed[0]);
  const [progress, setProgress] = useState<{ name: string; fraction: number; index: number; total: number } | null>(null);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setSpace(allowed[0]);
  }

  const onFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const tooBig = files.find((f) => validateTeamFile(f));
    if (tooBig) {
      toast.error(`"${tooBig.name}" pasa de 200 MB`);
      return;
    }
    let done = 0;
    try {
      for (const [index, file] of files.entries()) {
        setProgress({ name: file.name, fraction: 0, index, total: files.length });
        const up = await uploadTeamFile(teamname, file, (fraction) =>
          setProgress((p) => (p ? { ...p, fraction } : p)),
        );
        await addTeamFile(teamname, space, folderId, up);
        done++;
      }
      toast.success(done === 1 ? "Archivo subido" : `${done} archivos subidos`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setProgress(null);
    }
  };

  const pct = progress ? Math.round(progress.fraction * 100) : 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !progress && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir archivos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SpacePicker value={space} onChange={setSpace} allowed={allowed} disabled={Boolean(progress)} />
          <p className="text-xs text-muted-foreground">Cualquier tipo de archivo (PDF, Word, Excel, fotos, vídeos…) hasta 200 MB cada uno.</p>
          {progress && (
            <div className="space-y-2 text-sm">
              <p className="truncate">
                Subiendo {progress.total > 1 ? `${progress.index + 1} de ${progress.total}: ` : ""}
                {progress.name}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct}>
                <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <DialogFooter>
          <Button disabled={Boolean(progress)} onClick={() => input.current?.click()}>
            <Upload /> Elegir archivos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Documentos del equipo (2026-09-30): carpetas, documentos con bloques y
 * archivos. Cada cosa la ve todo el equipo o solo el cuerpo técnico; además
 * lo ve la dirección del club. Editan entrenadores y delegados.
 */
function TeamDocs() {
  const params = useSearchParams();
  const teamParam = params.get("team");
  const requested = params.get("folder");
  const access = useTeamDocsAccess(teamParam);
  const { team, canRead, canSeeStaff, canEdit } = access;
  const teamname = team?.teamname ?? null;
  const { docs: m, loading: loadingDocs } = useTeamDocs(teamname, canRead, canSeeStaff);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const close = (open: boolean) => !open && setDialog(null);
  const stuck = useLoadingTimeout(access.loading || (canRead && loadingDocs));

  if (access.loading || (canRead && loadingDocs)) {
    if (stuck) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Tarda más de lo normal"
          hint="Puede ser un problema de conexión — vuelve a intentarlo."
          action={<Button onClick={() => location.reload()}>Reintentar</Button>}
        />
      );
    }
    return <ListRowsSkeleton />;
  }
  if (!access.hasTeam || !team || !teamname) {
    return (
      <EmptyState
        icon={Folder}
        title="Equipo no encontrado"
        action={
          <Link href="/team" className={buttonVariants({ variant: "outline" })}>
            Ir a mi equipo
          </Link>
        }
      />
    );
  }
  if (!canRead) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo el equipo"
        hint="Los documentos los ven los miembros de este equipo, su cuerpo técnico y la dirección de su club."
      />
    );
  }

  const folderId = requested && m.folders[requested] ? requested : null;
  const path = breadcrumbOf(m, folderId);
  const current = folderId ? m.folders[folderId] : null;
  const { folders, docs, files } = contentsOf(m, folderId);
  const allowed = allowedSpaces(m, folderId);
  const href = (f: string | null) => teamDocsHref(teamParam, f);
  const empty = folders.length + docs.length + files.length === 0;

  const guard = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      throw e;
    }
  };
  const changeSpace = (item: ItemKind, id: string, to: TeamDocSpace) =>
    void guard(
      () => setTeamDocSpace(teamname, m, item, id, to),
      to === "staff" ? "Ahora solo lo ve el cuerpo técnico" : "Ahora lo ve todo el equipo",
    ).catch(() => {});
  const pickerFolders: Folders = Object.fromEntries(Object.entries(m.folders).map(([id, f]) => [id, f.item]));
  const parentBack = path.length > 1 ? path[path.length - 2] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink
        href={parentBack ? href(parentBack.id) : folderId ? href(null) : teamParam ? `/team?team=${encodeURIComponent(teamParam)}` : "/team"}
        label={parentBack ? parentBack.name : folderId ? "Documentos" : "Equipo"}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <span className="truncate">{current?.item.name ?? "Documentos"}</span>
            {current && <StaffBadge space={current.space} />}
          </h1>
          <nav aria-label="Ruta" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link href={href(null)} className="hover:underline">
              {teamname}
            </Link>
            {path.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                {c.id === folderId ? (
                  <span className="text-foreground">{c.name}</span>
                ) : (
                  <Link href={href(c.id)} className="hover:underline">
                    {c.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="icon-lg" aria-label="Nueva carpeta" onClick={() => setDialog({ kind: "newFolder" })}>
              <FolderPlus />
            </Button>
            <Button variant="outline" size="icon-lg" aria-label="Subir archivos" onClick={() => setDialog({ kind: "upload" })}>
              <Upload />
            </Button>
            <Link
              href={teamDocsHref(teamParam, folderId, "/edit")}
              className={buttonVariants({ size: "icon-lg" })}
              aria-label="Nuevo documento"
            >
              <Plus />
            </Link>
          </div>
        )}
      </div>

      {empty ? (
        <EmptyState
          icon={Folder}
          title={folderId ? "Carpeta vacía" : "Todavía no hay documentos"}
          hint={
            canEdit
              ? "Crea carpetas, escribe documentos con texto, PDF, vídeos y jugadas, o sube cualquier archivo. Tú decides si lo ve todo el equipo o solo el cuerpo técnico."
              : "Cuando el cuerpo técnico comparta documentos con el equipo, aparecerán aquí."
          }
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border py-1">
            {folders.map(({ id, space, item }) => {
              const count = countIn(m, id);
              return (
                <div key={id} className="flex items-center gap-2 py-1">
                  <Link href={href(id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-1 hover:bg-muted/50">
                    <Folder className="size-5 shrink-0 fill-muted text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                    <StaffBadge space={space} />
                    <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
                  </Link>
                  {canEdit && (
                    <RowMenu label={`Opciones de la carpeta ${item.name}`}>
                      <DropdownMenuItem onClick={() => setDialog({ kind: "rename", item: "folder", id, space, name: item.name })}>
                        <Pencil /> Renombrar
                      </DropdownMenuItem>
                      <SpaceMenuItem m={m} item="folder" id={id} space={space} parent={folderId} onChange={changeSpace} />
                      <DropdownMenuItem onClick={() => setDialog({ kind: "move", item: "folder", id, current: folderId })}>
                        <FolderInput /> Mover
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={count > 0}
                        onClick={() => setDialog({ kind: "delete", item: "folder", id, name: item.name })}
                      >
                        <Trash2 /> {count > 0 ? "Borrar (vacíala antes)" : "Borrar"}
                      </DropdownMenuItem>
                    </RowMenu>
                  )}
                </div>
              );
            })}
            {docs.map(({ id, space, item }) => (
              <div key={id} className="flex items-center gap-2 py-1">
                <Link
                  href={`/team/docs/doc?${new URLSearchParams({ ...(teamParam ? { team: teamParam } : {}), id }).toString()}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-1 hover:bg-muted/50"
                >
                  <FileText className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                  <StaffBadge space={space} />
                </Link>
                {canEdit && (
                  <RowMenu label={`Opciones del documento ${item.title}`}>
                    <DropdownMenuItem
                      render={
                        <Link href={`/team/docs/edit?${new URLSearchParams({ ...(teamParam ? { team: teamParam } : {}), id }).toString()}`} />
                      }
                    >
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <SpaceMenuItem m={m} item="doc" id={id} space={space} parent={folderId} onChange={changeSpace} />
                    <DropdownMenuItem onClick={() => setDialog({ kind: "move", item: "doc", id, current: folderId })}>
                      <FolderInput /> Mover
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDialog({ kind: "delete", item: "doc", id, name: item.title })}>
                      <Trash2 /> Borrar
                    </DropdownMenuItem>
                  </RowMenu>
                )}
              </div>
            ))}
            {files.map(({ id, space, item }) => (
              <div key={id} className="flex items-center gap-2 py-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-1 hover:bg-muted/50"
                >
                  <FileKindIcon kind={fileKind(item.contentType, item.name)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.name}</span>
                    {item.size ? <span className="block text-xs text-muted-foreground">{formatBytes(item.size)}</span> : null}
                  </span>
                  <StaffBadge space={space} />
                  <Download className="size-4 shrink-0 text-muted-foreground" />
                </a>
                {canEdit && (
                  <RowMenu label={`Opciones del archivo ${item.name}`}>
                    <DropdownMenuItem onClick={() => setDialog({ kind: "rename", item: "file", id, space, name: item.name })}>
                      <Pencil /> Renombrar
                    </DropdownMenuItem>
                    <SpaceMenuItem m={m} item="file" id={id} space={space} parent={folderId} onChange={changeSpace} />
                    <DropdownMenuItem onClick={() => setDialog({ kind: "move", item: "file", id, current: folderId })}>
                      <FolderInput /> Mover
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDialog({ kind: "delete", item: "file", id, name: item.name })}>
                      <Trash2 /> Borrar
                    </DropdownMenuItem>
                  </RowMenu>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!canSeeStaff && (
        <p className="text-xs text-muted-foreground">Ves lo que el cuerpo técnico comparte con todo el equipo.</p>
      )}

      <NameDialog
        open={dialog?.kind === "newFolder"}
        onOpenChange={close}
        title={folderId ? `Nueva carpeta en ${current?.item.name}` : "Nueva carpeta"}
        space={{ initial: allowed[0], allowed }}
        submitLabel="Crear"
        onSubmit={(name, space) => guard(async () => void (await createTeamFolder(teamname, space, name, folderId)), "Carpeta creada")}
      />
      <NameDialog
        open={dialog?.kind === "rename"}
        onOpenChange={close}
        title={dialog?.kind === "rename" && dialog.item === "file" ? "Renombrar archivo" : "Renombrar carpeta"}
        initialName={dialog?.kind === "rename" ? dialog.name : ""}
        maxLength={dialog?.kind === "rename" && dialog.item === "file" ? 200 : 120}
        submitLabel="Guardar"
        onSubmit={(name) => {
          const d = dialog as Extract<DialogState, { kind: "rename" }>;
          return guard(
            () => (d.item === "file" ? renameTeamFile(teamname, d.space, d.id, name) : renameTeamFolder(teamname, d.space, d.id, name)),
            "Nombre guardado",
          );
        }}
      />
      <UploadDialog open={dialog?.kind === "upload"} onOpenChange={close} teamname={teamname} folderId={folderId} allowed={allowed} />
      <FolderPickerDialog
        open={dialog?.kind === "move"}
        onOpenChange={close}
        title="Mover a…"
        rootLabel="Documentos (inicio)"
        folders={pickerFolders}
        current={dialog?.kind === "move" ? dialog.current : null}
        disabled={(target) => dialog?.kind === "move" && dialog.item === "folder" && !canMoveFolderTo(m, dialog.id, target)}
        onPick={(target) => {
          const d = dialog as Extract<DialogState, { kind: "move" }>;
          return guard(() => moveTeamDocItem(teamname, m, d.item, d.id, target), "Movido");
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={close}
        title={`¿Borrar ${dialog?.kind === "delete" ? `«${dialog.name}»` : ""}?`}
        description={
          dialog?.kind === "delete" && dialog.item !== "folder" ? "Se borra para todo el equipo, con sus archivos subidos." : undefined
        }
        confirmLabel="Borrar"
        destructive
        onConfirm={() => {
          const d = dialog as Extract<DialogState, { kind: "delete" }>;
          if (d.item === "folder") return guard(() => deleteTeamFolder(teamname, m.folders[d.id].space, d.id), "Carpeta borrada");
          if (d.item === "doc") return guard(() => deleteTeamDoc(teamname, m.docs[d.id].space, d.id, m.docs[d.id].item), "Documento borrado");
          const f = m.files[d.id];
          return guard(() => deleteTeamFile(teamname, f.space, d.id, f.item.path), "Archivo borrado");
        }}
      />
    </div>
  );
}

export default function TeamDocsPage() {
  return (
    <Suspense fallback={<ListRowsSkeleton />}>
      <TeamDocs />
    </Suspense>
  );
}
