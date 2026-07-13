"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { Eye, EyeOff, MailWarning } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/firebase";

function loginErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email o contraseña incorrectos.";
      case "auth/too-many-requests":
        return "Demasiados intentos. Prueba de nuevo en unos minutos.";
      case "auth/popup-closed-by-user":
        return "Inicio de sesión con Google cancelado.";
    }
  }
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

export default function LoginPage() {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unverifiedUser, setUnverifiedUser] = useState<import("firebase/auth").User | null>(null);

  useEffect(() => {
    if (firebaseUser) router.replace("/exercises");
  }, [firebaseUser, router]);

  const loginWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setUnverifiedUser(null);
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        // Mismo comportamiento que Android: sin verificar no hay sesión.
        setUnverifiedUser(cred.user);
        await signOut(auth);
        return;
      }
      router.replace("/exercises");
    } catch (error) {
      setErrorMsg(loginErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const loginWithGoogle = async () => {
    setErrorMsg(null);
    setUnverifiedUser(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace("/exercises");
    } catch (error) {
      setErrorMsg(loginErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!unverifiedUser) return;
    try {
      await sendEmailVerification(unverifiedUser);
      toast.success("Correo de verificación reenviado.");
    } catch {
      toast.error("No se pudo reenviar el correo. Inténtalo más tarde.");
    }
  };

  return (
    <main className="auth-bg flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="mx-auto mb-2 size-16 shadow-lg shadow-primary/25" />
          <CardTitle className="text-2xl tracking-tight">RugbySet</CardTitle>
          <CardDescription>
            Inicia sesión con tu cuenta de la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unverifiedUser && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-center text-sm">
              <MailWarning className="size-5 text-warning" />
              <p>
                Verifica tu email antes de iniciar sesión. Revisa tu bandeja
                de entrada.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => void resendVerification()}>
                Reenviar verificación
              </Button>
            </div>
          )}

          <form onSubmit={loginWithEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <Button type="submit" size="xl" className="w-full" disabled={busy}>
              {busy ? "Entrando…" : "Iniciar sesión"}
            </Button>
          </form>

          <Separator />

          <Button
            variant="outline"
            size="xl"
            className="w-full"
            disabled={busy}
            onClick={() => void loginWithGoogle()}
          >
            Continuar con Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="underline underline-offset-4">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
