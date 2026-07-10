"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (firebaseUser) router.replace("/exercises");
  }, [firebaseUser, router]);

  const loginWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        // Mismo comportamiento que Android: sin verificar no hay sesión.
        await signOut(auth);
        toast.error("Verifica tu email antes de iniciar sesión. Revisa tu bandeja de entrada.");
        return;
      }
      router.replace("/exercises");
    } catch (error) {
      toast.error(loginErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const loginWithGoogle = async () => {
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace("/exercises");
    } catch (error) {
      toast.error(loginErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="mx-auto mb-2 size-16 shadow-lg shadow-indigo-500/25" />
          <CardTitle className="text-2xl tracking-tight">RugbySet</CardTitle>
          <CardDescription>
            Inicia sesión con tu cuenta de la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
              {busy ? "Entrando…" : "Iniciar sesión"}
            </Button>
          </form>

          <Separator />

          <Button
            variant="outline"
            size="lg"
            className="h-11 w-full"
            disabled={busy}
            onClick={loginWithGoogle}
          >
            Continuar con Google
          </Button>

          <div className="space-y-1 text-center text-sm text-muted-foreground">
            <p>
              <Link href="/forgot-password" className="underline underline-offset-4">
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
            <p>¿Sin cuenta? Regístrate desde la app Android.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
