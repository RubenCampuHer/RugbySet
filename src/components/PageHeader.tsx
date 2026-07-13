import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Cabecera de pantalla estándar — sustituye el `<h1 className="text-2xl
 * font-bold">` repetido a mano en cada página, con badge de conteo y slot
 * de acción opcionales.
 */
export function PageHeader({
  title,
  count,
  action,
  className,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        {title}
        {count != null && (
          <Badge variant="secondary" className="font-normal">
            {count}
          </Badge>
        )}
      </h1>
      {action}
    </div>
  );
}
