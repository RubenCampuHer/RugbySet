// Redimensiona (máx. 1600px lado mayor) y comprime a JPEG ~0.85 en el
// navegador antes de subir a Firebase Storage — sin recortador ni
// dependencias nuevas (decisión del plan de paridad F1).
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function resizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Redimensiona/comprime [file] y lo sube a `${folder}/{timestamp}.jpg`,
 * devuelve la downloadURL (usable directamente en <img src>, igual que
 * Android). Reutilizado por ejercicios (F1) e icono de equipo (F6).
 */
export async function resizeAndUpload(folder: string, file: Blob): Promise<string> {
  const resized = await resizeImage(file);
  const storageRef = ref(storage, `${folder}/${Date.now()}.jpg`);
  await uploadBytes(storageRef, resized, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}
