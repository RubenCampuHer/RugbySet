"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Chips de etiquetas libres (escribir + Enter añade) — usado en los
 * formularios de ejercicio y entreno. No depende del nodo Etiquetas de
 * Android (divergencia deliberada, ver plan de paridad F1).
 */
export function TagInput({
  id = "tagInput",
  label = "Etiquetas",
  value,
  onChange,
}: {
  id?: string;
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const tag = input.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Escribe y pulsa Enter"
        />
        <Button type="button" variant="outline" onClick={add}>
          Añadir
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Quitar etiqueta ${tag}`}
                className="rounded-full hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
