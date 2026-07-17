// Techo antes de siquiera intentar procesar el archivo en el navegador —
// más allá de esto no vale la pena ni comprimir, se le pide otra foto.
export const TAMANO_MAXIMO_ORIGINAL_BYTES = 30 * 1024 * 1024;

// Comprime una foto en el navegador antes de subirla: la redimensiona a un
// máximo razonable y la reexporta como JPEG con buena calidad. Las fotos de
// producto se muestran como máximo a ~150px de ancho en la app (tarjetas de
// catálogo, kiosko) — 1600px de lado más largo es varias veces más de lo que
// hace falta incluso en pantallas de altísima densidad, así que no hay
// pérdida de nitidez visible, pero el peso baja de varios MB a unos cientos
// de KB en la mayoría de los casos.
export async function comprimirImagen(
  file: File,
  { maxDimension = 1600, calidad = 0.85 }: { maxDimension?: number; calidad?: number } = {},
): Promise<File> {
  // Ya es liviana — no vale la pena tocarla.
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", calidad),
    );

    // Si por lo que sea la versión comprimida no quedó más liviana (fotos ya
    // muy optimizadas, capturas de pantalla pequeñas), se sube la original.
    if (!blob || blob.size >= file.size) return file;

    const nombreBase = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${nombreBase}.jpg`, { type: "image/jpeg" });
  } catch {
    // Formato que el navegador no puede decodificar, navegador viejo, etc. —
    // se sube la original tal cual en vez de bloquear la subida.
    return file;
  }
}
