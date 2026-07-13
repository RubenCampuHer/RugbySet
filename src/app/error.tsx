"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="dark flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-foreground">
        <TriangleAlert className="size-10 text-destructive" />
        <p className="text-center font-medium">Algo ha ido mal.</p>
        <Button onClick={reset}>Reintentar</Button>
      </body>
    </html>
  );
}
