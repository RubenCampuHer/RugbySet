"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <TriangleAlert className="size-10 text-destructive" />
      <p className="font-medium">Algo ha ido mal en esta pantalla.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
