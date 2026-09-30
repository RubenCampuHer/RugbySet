import { splitLinks } from "@/lib/linkify";
import { cn } from "@/lib/utils";

/** Texto libre con las URLs convertidas en enlaces que abren en otra pestaña (2026-09-30). */
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {splitLinks(text).map((part, i) =>
        part.type === "text" ? (
          part.value
        ) : (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            title={part.url}
            className="break-all text-primary underline underline-offset-4"
          >
            {part.label}
          </a>
        ),
      )}
    </p>
  );
}
