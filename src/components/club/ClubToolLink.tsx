import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

/** Acceso a una herramienta del club desde /club (avisos, calendario, números…). */
export function ClubToolLink({ href, icon: Icon, title, hint }: { href: string; icon: LucideIcon; title: string; hint: string }) {
  return (
    <Card>
      <CardContent className="py-1">
        <Link href={href} className="flex min-h-14 items-center gap-3 rounded-md px-1 hover:bg-muted/50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
