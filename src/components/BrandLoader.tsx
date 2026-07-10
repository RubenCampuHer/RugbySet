import { Logo } from "@/components/Brand";

export function BrandLoader() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo className="size-16 animate-pulse" />
      <p className="text-sm font-semibold tracking-tight text-[#818CF8]">
        RugbySet
      </p>
    </main>
  );
}
