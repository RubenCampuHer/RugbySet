#!/usr/bin/env node
/**
 * @fileoverview fix-rsc-static-export-aliases.mjs
 *
 * Workaround para un bug de Next.js 16 con `output: 'export'`: el build
 * escribe el payload RSC de cada ruta bajo carpetas anidadas
 * (`__next.<opaco>/<segmentos de ruta>/__PAGE__.txt`, y a veces un fichero
 * plano directamente dentro, `__next.<opaco>/<segmento>.txt`), pero el
 * router del cliente, al navegar entre páginas (no solo al hacer prefetch
 * en hover), lo pide con un nombre PLANO separado por puntos
 * (`__next.<opaco>.<segmentos>.__PAGE__.txt`). Ese fichero plano no existe
 * en disco → 404 → la navegación client-side se aborta en silencio (la URL
 * no cambia, la pantalla se queda como estaba).
 *
 * Este script recorre `out/` tras el build, encuentra cada carpeta
 * `__next.*` y crea, junto a ella, un alias plano (copia, no in mueve) de
 * CADA fichero que haya dentro a cualquier profundidad — a diferencia de
 * workarounds que solo cubren un nivel (`__PAGE__.txt` suelto), aquí hace
 * falta cubrir más porque este build anida un nivel extra por ruta
 * (ej. tanto `team.txt` como `team/__PAGE__.txt` dentro de la misma
 * carpeta `__next.!KGFwcCk`).
 *
 * Bug reportado, sin fix oficial todavía: https://github.com/vercel/next.js/issues/85374
 *
 * Uso:
 *   node scripts/fix-rsc-static-export-aliases.mjs          # por defecto ./out
 *   node scripts/fix-rsc-static-export-aliases.mjs dist     # carpeta custom
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_BUILD_DIR = "out";
const RSC_DIR_PREFIX = "__next.";

function isSystemError(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (isSystemError(error, "ENOENT")) return null;
    throw error;
  }
}

/** Recorre `dir` recursivamente y devuelve las rutas relativas de todos los ficheros. */
async function listFilesRecursive(dir) {
  const out = [];
  const entries = await safeReadDir(dir);
  if (!entries) return out;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFilesRecursive(full);
      for (const rel of nested) out.push(path.join(entry.name, rel));
    } else if (entry.isFile()) {
      out.push(entry.name);
    }
  }
  return out;
}

/** Recorre `rootDir` buscando carpetas `__next.*` en cualquier nivel. */
async function* walkRscDirectories(rootDir) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = await safeReadDir(currentDir);
    if (!entries) continue;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(RSC_DIR_PREFIX)) {
        yield { parentDir: currentDir, rscFolderName: entry.name };
        // No se espera otra carpeta __next.* dentro de una ya encontrada,
        // pero por si acaso no se descarta seguir bajando dentro de ella.
      }
      stack.push(path.join(currentDir, entry.name));
    }
  }
}

async function run(buildDir) {
  const exists = await fs
    .access(buildDir)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    console.warn(
      `[fix-rsc-static-export-aliases] Carpeta de build "${buildDir}" no encontrada — ¿corriste "next build" antes?`,
    );
    return;
  }

  let created = 0;
  let rscFoldersSeen = 0;

  for await (const { parentDir, rscFolderName } of walkRscDirectories(buildDir)) {
    rscFoldersSeen += 1;
    const rscDir = path.join(parentDir, rscFolderName);
    const relFiles = await listFilesRecursive(rscDir);

    for (const rel of relFiles) {
      const dotJoined = rel.split(path.sep).join(".");
      const flatPath = path.join(parentDir, `${rscFolderName}.${dotJoined}`);
      await fs.copyFile(path.join(rscDir, rel), flatPath);
      created += 1;
    }
  }

  console.log(
    `[fix-rsc-static-export-aliases] ${rscFoldersSeen} carpeta(s) __next.* encontradas, ${created} alias plano(s) creados/actualizados en "${buildDir}".`,
  );
}

const buildDirArg = process.argv[2] ?? DEFAULT_BUILD_DIR;
run(path.resolve(process.cwd(), buildDirArg)).catch((error) => {
  console.error("[fix-rsc-static-export-aliases] Error inesperado:", error);
  process.exitCode = 1;
});
