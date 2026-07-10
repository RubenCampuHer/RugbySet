import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SPA estática: todo el dato viene de RTDB en el cliente, no hay SSR.
  // Se sirve desde Firebase Hosting (carpeta `out`).
  output: "export",
  // Las imágenes son URLs de Firebase Storage con token; el optimizador de
  // Next no funciona con output:export.
  images: { unoptimized: true },
  // Hay un package-lock.json suelto en C:\Users\ruben que confunde la
  // detección de workspace de Turbopack.
  turbopack: { root: __dirname },
};

export default nextConfig;
