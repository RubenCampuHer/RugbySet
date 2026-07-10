"use client";

import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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
import { functions } from "@/lib/firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Misma callable custom que Android (EmailService.kt); no requiere
      // auth y siempre responde éxito (anti-enumeración de emails).
      await httpsCallable(functions, "sendCustomPasswordResetEmail")({ email });
      setSent(true);
    } catch {
      toast.error("No se pudo procesar la solicitud. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#818CF8] text-3xl shadow-lg shadow-indigo-500/25">
            🏉
          </div>
          <CardTitle className="text-2xl tracking-tight">
            Recuperar contraseña
          </CardTitle>
          <CardDescription>
            Te enviaremos un enlace para restablecerla.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <p className="text-sm">
              Si el correo existe, recibirás el enlace en tu bandeja de entrada.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
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
              <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
                {busy ? "Enviando…" : "Enviar enlace"}
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline underline-offset-4">
              Volver al inicio de sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
