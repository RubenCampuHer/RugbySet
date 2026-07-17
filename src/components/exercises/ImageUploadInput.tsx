"use client";

import { ImagePlus, PenLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WhiteboardDialog } from "@/components/whiteboard/WhiteboardDialog";

/**
 * Selector de imagen con preview local (object URL) — el redimensionado y
 * la subida a Storage ocurren al guardar (ver resizeAndUpload en
 * lib/storage.ts), no aquí. Sin recortador (decisión del plan F1).
 *
 * También aloja la pizarra táctica (whiteboard): al guardar, exporta un JPEG
 * que sustituye a `value` por el mismo camino que una foto normal, y guarda
 * aparte el JSON editable en `boardData` (espejo de Exercise.boardData).
 */
export function ImageUploadInput({
  value,
  onChange,
  boardData = null,
  onBoardChange,
}: {
  /** downloadURL existente o preview local del archivo elegido. */
  value: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
  boardData?: string | null;
  onBoardChange?: (boardData: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);

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
    onBoardChange?.(null); // una foto normal reemplaza cualquier pizarra previa
  };

  const clear = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    onChange(null, null);
    onBoardChange?.(null);
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
          <img src={value} alt="" className="aspect-video w-full rounded-lg object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setWhiteboardOpen(true)}
            >
              <PenLine className="size-4" />
              {boardData ? "Editar pizarra" : "Dibujar pizarra"}
            </Button>
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            Añadir imagen
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setWhiteboardOpen(true)}
          >
            <PenLine className="size-4" />
            Dibujar pizarra
          </Button>
        </div>
      )}

      {whiteboardOpen && (
        <WhiteboardDialog
          open={whiteboardOpen}
          onOpenChange={setWhiteboardOpen}
          initialBoardData={boardData}
          onSave={({ file, previewUrl, boardData: newBoardData }) => {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = previewUrl;
            onChange(file, previewUrl);
            onBoardChange?.(newBoardData);
          }}
        />
      )}
    </div>
  );
}
