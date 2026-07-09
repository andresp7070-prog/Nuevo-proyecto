import type { createClient } from "@/lib/supabase/server";

const BUCKET_POR_DEFECTO = "inventario-fotos";
const EXPIRA_SEGUNDOS = 3600;

export const TAMANO_MAXIMO_FOTO_BYTES = 5 * 1024 * 1024;
export const TAMANO_MAXIMO_LOGO_BYTES = 2 * 1024 * 1024;

export function errorTamanoFoto(file: File, maxBytes: number = TAMANO_MAXIMO_FOTO_BYTES): string | null {
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return `El archivo pesa más de ${maxMb}MB — elige uno más liviano.`;
  }
  return null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function firmarFotoUrl(
  supabase: SupabaseServerClient,
  path: string | null,
  bucket: string = BUCKET_POR_DEFECTO,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, EXPIRA_SEGUNDOS);
  return data?.signedUrl ?? null;
}

export async function firmarFotoUrls(
  supabase: SupabaseServerClient,
  paths: (string | null)[],
  bucket: string = BUCKET_POR_DEFECTO,
): Promise<Record<string, string>> {
  const pathsValidos = paths.filter((p): p is string => Boolean(p));
  if (pathsValidos.length === 0) return {};

  const { data } = await supabase.storage.from(bucket).createSignedUrls(pathsValidos, EXPIRA_SEGUNDOS);

  const resultado: Record<string, string> = {};
  for (const fila of data ?? []) {
    if (fila.path && fila.signedUrl) resultado[fila.path] = fila.signedUrl;
  }
  return resultado;
}
