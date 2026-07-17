import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Por defecto Next.js limita el cuerpo de una Server Action a 1MB — las
    // fotos de producto se validan hasta 5MB (ver TAMANO_MAXIMO_FOTO_BYTES en
    // src/lib/fotos.ts), así que cualquier foto entre 1 y 5MB se rechazaba en
    // el servidor sin avisar nada.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
