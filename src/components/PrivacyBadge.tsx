import { Globe, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Visibilidad del contenido con icono y color propios — espejo del patrón
 * Android (ic_lock para Privado, ic_public para Público) ampliado con
 * Equipo en indigo de marca.
 */
export function PrivacyBadge({ privacy }: { privacy: string | null | undefined }) {
  switch (privacy) {
    case "Privado":
      return (
        <Badge className="gap-1 border-transparent bg-warning/15 text-warning">
          <Lock className="size-3" /> Privado
        </Badge>
      );
    case "Equipo":
      return (
        <Badge className="gap-1 border-transparent bg-primary/15 text-brand">
          <Users className="size-3" /> Equipo
        </Badge>
      );
    case "Publico":
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Globe className="size-3" /> Público
        </Badge>
      );
    default:
      return null;
  }
}

/** Estado de aprobación — solo se muestra cuando aporta (pendiente/rechazado). */
export function ApprovalBadge({ status }: { status: string | null | undefined }) {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="border-transparent bg-warning/15 text-warning">
          Pendiente de aprobación
        </Badge>
      );
    case "REJECTED":
      return <Badge variant="destructive">Rechazado</Badge>;
    default:
      return null;
  }
}
