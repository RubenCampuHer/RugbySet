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
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
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
              <Button type="submit" className="w-full" disabled={busy}>
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
