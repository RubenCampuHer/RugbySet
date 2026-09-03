"use client";

import { Copy, ImagePlus, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { BrandLoader } from "@/components/BrandLoader";
import { Logo } from "@/components/Brand";
import { JoinTeamForm } from "@/components/team/JoinTeamForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { joinTeamByCode } from "@/lib/actions/team";
import {
  CLUB_CATEGORIES,
  createClubAndTeam,
  createStandaloneTeam,
  getClubByCode,
  markOnboardingComplete,
  randomCodeSuffix,
  setUserRole,
  suggestTeamCode,
  validateTeamCode,
  validateTeamName,
} from "@/lib/actions/onboarding";
import { markOnboardingDone } from "@/lib/onboarding-flag";
import { resizeAndUpload } from "@/lib/storage";

type Step =
  | "role"
  | "player"
  | "coach-choice"
  | "team-standalone"
  | "club-info"
  | "club-team"
  | "team-created";

/**
 * Wizard post-login para usuarios nuevos (sobre todo primer login con
 * Google — la web no tiene registro propio) — mirror de SetupActivity +
 * fragments en Android: elegir rol, y según el rol, unirse a un equipo o
 * crear equipo (con o sin club). El guard que trae aquí vive en
 * (app)/layout.tsx; al terminar (o "Saltar") vuelve a /exercises.
 */
export default function OnboardingPage() {
  const { firebaseUser, profile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [busy, setBusy] = useState(false);

  // Datos del club pendiente cuando la rama es "Club + equipo" (mirror de
  // los argumentos que SetupCreateClubFragment pasa a SetupCreateTeamFragment).
  const [pendingClub, setPendingClub] = useState<{
    name: string;
    code: string;
    iconUrl: string | null;
  } | null>(null);

  // Equipo recién creado — se muestra en el paso "team-created" para que el
  // código quede repetido en algún sitio persistente (antes solo aparecía en
  // un toast transitorio, sin decir nunca "compártelo con tus jugadores").
  const [createdTeam, setCreatedTeam] = useState<{ name: string; code: string } | null>(null);

  const copyCreatedCode = async () => {
    if (!createdTeam) return;
    try {
      await navigator.clipboard.writeText(createdTeam.code);
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar el código");
    }
  };

  useEffect(() => {
    if (firebaseUser === null) router.replace("/login");
  }, [firebaseUser, router]);

  const finish = async () => {
    if (firebaseUser) {
      // Local primero (evita parpadeo en esta pestaña mientras el `update`
      // de servidor viaja) y de servidor después (autoridad real para
      // cualquier otro navegador/dispositivo — ver markOnboardingComplete).
      markOnboardingDone(firebaseUser.uid);
      try {
        await markOnboardingComplete(firebaseUser.uid);
      } catch {
        // El flag local ya deja pasar en esta pestaña; no bloquear la salida.
      }
    }
    router.replace("/exercises");
  };

  if (firebaseUser === undefined || firebaseUser === null || !profile) {
    return <BrandLoader />;
  }

  const coachName = profile.nameSurname?.trim() || profile.username?.trim() || "";

  const chooseRole = async (role: "PLAYER" | "COACH") => {
    setBusy(true);
    try {
      await setUserRole(firebaseUser.uid, role);
      setStep(role === "PLAYER" ? "player" : "coach-choice");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar tu rol");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-bg flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Logo className="mx-auto mb-2 size-14" />
          <CardTitle className="text-xl tracking-tight">¡Bienvenido a RugbySet!</CardTitle>
          <CardDescription>
            {step === "role" && "Antes de empezar, cuéntanos quién eres."}
            {step === "player" && "Únete a tu equipo con el código que te dio tu entrenador."}
            {step === "coach-choice" && "¿Cómo quieres organizar tu equipo?"}
            {step === "team-standalone" && "Crea tu equipo y elige un código para que tus jugadores se unan."}
            {step === "club-info" && "Crea tu club. El primer equipo va después."}
            {step === "club-team" && "El primer equipo del club. Elige un código para que tus jugadores se unan."}
            {step === "team-created" && "¡Ya está! Comparte el código con tu equipo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "role" && (
            <div className="grid grid-cols-2 gap-3">
              <RoleCard
                icon={<User className="size-6" />}
                label="Soy jugador"
                disabled={busy}
                onClick={() => void chooseRole("PLAYER")}
              />
              <RoleCard
                icon={<Shield className="size-6" />}
                label="Soy entrenador"
                disabled={busy}
                onClick={() => void chooseRole("COACH")}
              />
            </div>
          )}

          {step === "player" && (
            <div className="space-y-3">
              <JoinTeamForm onJoined={() => void finish()} />
              <Button variant="ghost" className="w-full" onClick={() => void finish()}>
                Saltar por ahora
              </Button>
            </div>
          )}

          {step === "coach-choice" && (
            <div className="grid gap-3">
              <button
                type="button"
                className="rounded-lg border p-4 text-left hover:bg-muted"
                onClick={() => setStep("team-standalone")}
              >
                <p className="font-medium">Solo un equipo</p>
                <p className="text-sm text-muted-foreground">
                  Crea tu equipo directamente, sin club.
                </p>
              </button>
              <button
                type="button"
                className="rounded-lg border p-4 text-left hover:bg-muted"
                onClick={() => setStep("club-info")}
              >
                <p className="font-medium">Club con varios equipos</p>
                <p className="text-sm text-muted-foreground">
                  Crea un club (Seniors, Sub-18, Femenino…) y su primer equipo.
                </p>
              </button>
            </div>
          )}

          {step === "team-standalone" && (
            <TeamForm
              submitLabel="Crear equipo"
              busy={busy}
              onSubmit={async ({ name, code, iconFile, alsoPlayer }) => {
                setBusy(true);
                try {
                  // Las reglas RTDB no dejan a un no-miembro leer /Teams, así
                  // que no se puede comprobar el código con una query directa
                  // (a diferencia de los clubes, ver getClubByCode abajo) —
                  // se reutiliza joinTeamByCode en modo dryRun, ya desplegada
                  // y usada por JoinTeamForm para exactamente esta búsqueda.
                  const dup = await joinTeamByCode(code, true);
                  if (dup.found) {
                    toast.error(
                      'Ese código ya lo usa otro equipo. Prueba "Sugerir otro" o cámbialo.',
                    );
                    return;
                  }
                  const iconUrl = iconFile
                    ? await resizeAndUpload(`team_images/${name}`, iconFile)
                    : null;
                  await createStandaloneTeam({
                    teamName: name,
                    teamCode: code,
                    iconUrl,
                    coachName,
                    uid: firebaseUser.uid,
                    alsoPlayer,
                  });
                  setCreatedTeam({ name, code });
                  setStep("team-created");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error al crear el equipo");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          {step === "club-info" && (
            <ClubInfoForm
              busy={busy}
              onSubmit={async ({ name, code, iconFile }) => {
                setBusy(true);
                try {
                  const existing = await getClubByCode(code);
                  if (existing) {
                    toast.error("Este código de club ya está en uso. Elige otro.");
                    return;
                  }
                  const iconUrl = iconFile
                    ? await resizeAndUpload(`club_icons/${name}`, iconFile)
                    : null;
                  setPendingClub({ name, code, iconUrl });
                  setStep("club-team");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error al comprobar el club");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          {step === "club-team" && pendingClub && (
            <TeamForm
              submitLabel="Crear club y equipo"
              busy={busy}
              withCategory
              onSubmit={async ({ name, code, iconFile, category, alsoPlayer }) => {
                setBusy(true);
                try {
                  const dup = await joinTeamByCode(code, true);
                  if (dup.found) {
                    toast.error(
                      'Ese código ya lo usa otro equipo. Prueba "Sugerir otro" o cámbialo.',
                    );
                    return;
                  }
                  const iconUrl = iconFile
                    ? await resizeAndUpload(`team_images/${name}`, iconFile)
                    : null;
                  await createClubAndTeam({
                    clubName: pendingClub.name,
                    clubCode: pendingClub.code,
                    clubIconUrl: pendingClub.iconUrl,
                    category: category ?? CLUB_CATEGORIES[0],
                    teamName: name,
                    teamCode: code,
                    teamIconUrl: iconUrl,
                    coachName,
                    uid: firebaseUser.uid,
                    alsoPlayer,
                  });
                  setCreatedTeam({ name, code });
                  setStep("team-created");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error al crear el club y el equipo");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          {step === "team-created" && createdTeam && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Equipo <span className="font-medium text-foreground">{createdTeam.name}</span> creado.
              </p>
              <button
                type="button"
                onClick={() => void copyCreatedCode()}
                className="mx-auto flex items-center gap-2 rounded-lg border-2 border-dashed border-primary/40 px-4 py-3 font-mono text-lg font-bold tracking-wider hover:bg-muted"
                aria-label="Copiar código de equipo"
              >
                {createdTeam.code}
                <Copy className="size-4 text-muted-foreground" />
              </button>
              <p className="text-sm text-muted-foreground">
                Comparte este código con tus jugadores para que se unan al equipo.
              </p>
              <Button className="w-full" onClick={() => void finish()}>
                Continuar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function RoleCard({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-lg border p-5 text-center transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

/** Selector de imagen simple (sin recortador) — mirror de team/page.tsx (icono de equipo). */
function IconPicker({
  preview,
  onChange,
  label,
}: {
  preview: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          onChange(file, file ? URL.createObjectURL(file) : null);
        }}
      />
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview local, sin optimizador (output: export)
          <img src={preview} alt="" className="size-12 rounded-full object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ImagePlus className="size-5" />
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {preview ? "Cambiar" : "Añadir imagen"}
        </Button>
      </div>
    </div>
  );
}

function TeamForm({
  submitLabel,
  busy,
  withCategory,
  onSubmit,
}: {
  submitLabel: string;
  busy: boolean;
  withCategory?: boolean;
  onSubmit: (data: {
    name: string;
    code: string;
    iconFile: File | null;
    category?: string;
    alsoPlayer: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  // Desmarcado por defecto (rediseño multi-coach 2026-09-03): ser
  // entrenador ya no implica ser jugador — quien también juega lo marca
  // explícitamente.
  const [alsoPlayer, setAlsoPlayer] = useState(false);
  // Código autosugerido desde el nombre — el entrenador confundía "Código
  // de acceso" con algo que debía recibir, no inventar (ver plan onboarding
  // 2026-09-03). Precargarlo, editable, deja claro que es él quien lo
  // elige. Mientras no lo toque directamente (codeTouched=false), sigue al
  // nombre en vivo; en cuanto lo edita o pide "Sugerir otro", deja de
  // seguirlo para no pisar su elección.
  const [suffix, setSuffix] = useState(() => randomCodeSuffix());
  const [codeTouched, setCodeTouched] = useState(false);
  const [code, setCode] = useState(() => suggestTeamCode("", suffix));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(CLUB_CATEGORIES[0]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(null);
    if (!codeTouched) setCode(suggestTeamCode(value, suffix));
  };

  const regenerateCode = () => {
    const newSuffix = randomCodeSuffix();
    setSuffix(newSuffix);
    setCode(suggestTeamCode(name, newSuffix));
    setCodeTouched(true);
    setCodeError(null);
  };

  const submit = () => {
    const nameErr = validateTeamName(name);
    setNameError(nameErr);
    const codeErr = validateTeamCode(code);
    setCodeError(codeErr);
    if (nameErr || codeErr) return;
    onSubmit({
      name: name.trim(),
      code: code.trim(),
      iconFile,
      category: withCategory ? category : undefined,
      alsoPlayer,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="team-name">Nombre del equipo</Label>
        <Input
          id="team-name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={busy}
        />
        {nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="team-code">Código de acceso</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground"
            disabled={busy}
            onClick={regenerateCode}
          >
            🔄 Sugerir otro
          </Button>
        </div>
        <Input
          id="team-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeTouched(true);
            setCodeError(null);
          }}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          Lo eliges tú (o usa el sugerido) — se lo compartirás a tus jugadores para unirse.
        </p>
        {codeError && <p className="text-sm text-destructive">{codeError}</p>}
      </div>
      {withCategory && (
        <div className="space-y-1">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? CLUB_CATEGORIES[0])} disabled={busy}>
            <SelectTrigger className="w-full">
              <SelectValue>{category}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CLUB_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <IconPicker
        label="Icono del equipo (opcional)"
        preview={iconPreview}
        onChange={(file, url) => { setIconFile(file); setIconPreview(url); }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={alsoPlayer}
          disabled={busy}
          onChange={(e) => setAlsoPlayer(e.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        También quiero aparecer como jugador
      </label>
      <Button className="w-full" disabled={busy || !name.trim() || !code.trim()} onClick={submit}>
        {busy ? "Creando…" : submitLabel}
      </Button>
    </div>
  );
}

function ClubInfoForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (data: { name: string; code: string; iconFile: File | null }) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="club-name">Nombre del club</Label>
        <Input id="club-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="club-code">Código de acceso</Label>
        <Input id="club-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
      </div>
      <IconPicker
        label="Icono del club (opcional)"
        preview={iconPreview}
        onChange={(file, url) => { setIconFile(file); setIconPreview(url); }}
      />
      <Button
        className="w-full"
        disabled={busy || !name.trim() || !code.trim()}
        onClick={() => onSubmit({ name: name.trim(), code: code.trim(), iconFile })}
      >
        {busy ? "Comprobando…" : "Siguiente"}
      </Button>
    </div>
  );
}
