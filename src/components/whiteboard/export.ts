import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BoardSvg } from "./BoardSvg";
import { BOARD_HEIGHT, BOARD_WIDTH, type BoardObject } from "./types";

/** Renderiza el estado de la pizarra (sin selección ni handles) a un JPEG. */
export async function boardToJpegFile(objects: BoardObject[]): Promise<File> {
  const markup = renderToStaticMarkup(
    createElement(BoardSvg, { objects, interactive: false }),
  );

  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo renderizar la pizarra"));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = BOARD_WIDTH;
    canvas.height = BOARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no soportado");
    ctx.drawImage(image, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!jpegBlob) throw new Error("No se pudo exportar la pizarra");

    return new File([jpegBlob], "pizarra.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
