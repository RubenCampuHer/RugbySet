"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Selector de imagen con preview local (object URL) — el redimensionado y
 * la subida a Storage ocurren al guardar (ver resizeAndUpload en
 * lib/storage.ts), no aquí. Sin recortador (decisión del plan F1).
 */
export function ImageUploadInput({
  value,
  onChange,
}: {
  /** downloadURL existente o preview local del archivo elegido. */
  value: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    onChange(file, url);
  };

  const clear = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    onChange(null, null);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview local/Storage, sin optimizador (output: export) */}
          <img src={value} alt="" className="h-40 w-full rounded-lg object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Cambiar
            </Button>
            <Button type="button" variant="destructive" size="icon-sm" onClick={clear}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          Añadir imagen
        </Button>
      )}
    </div>
  );
}
