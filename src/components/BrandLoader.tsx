import { Logo } from "@/components/Brand";

export function BrandLoader() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 animate-in fade-in duration-700">
      <Logo className="size-16 animate-pulse" />
      <p className="text-sm font-semibold tracking-tight text-brand">
        RugbySet
      </p>
    </main>
  );
}
