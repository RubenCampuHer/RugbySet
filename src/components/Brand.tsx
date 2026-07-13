import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo real de la app (la "R" con el balón, mismo asset que el launcher Android). */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt=""
      width={192}
      height={192}
      priority
      className={cn("rounded-2xl", className)}
    />
  );
}

/** Logo + nombre — la referencia de marca estándar (header, login, cargas). */
export function BrandMark({
  className,
  logoClassName,
  textClassName,
}: {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo className={cn("size-8 rounded-lg", logoClassName)} />
      <span
        className={cn(
          "text-lg font-bold tracking-tight text-brand",
          textClassName,
        )}
      >
        RugbySet
      </span>
    </span>
  );
}
