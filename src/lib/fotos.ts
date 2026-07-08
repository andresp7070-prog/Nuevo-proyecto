import type { createClient } from "@/lib/supabase/server";

const BUCKET = "inventario-fotos";
const EXPIRA_SEGUNDOS = 3600;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function firmarFotoUrl(
  supabase: SupabaseServerClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRA_SEGUNDOS);
  return data?.signedUrl ?? null;
}

export async function firmarFotoUrls(
  supabase: SupabaseServerClient,
  paths: (string | null)[],
): Promise<Record<string, string>> {
  const pathsValidos = paths.filter((p): p is string => Boolean(p));
  if (pathsValidos.length === 0) return {};

  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(pathsValidos, EXPIRA_SEGUNDOS);

  const resultado: Record<string, string> = {};
  for (const fila of data ?? []) {
    if (fila.path && fila.signedUrl) resultado[fila.path] = fila.signedUrl;
  }
  return resultado;
}
