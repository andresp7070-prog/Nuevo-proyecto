import { requerirAdmin } from "@/lib/empresa";

function refSupabaseDesdeUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const match = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

async function llamar(url: string, token: string | undefined) {
  if (!token) return { url, error: "Falta el token en las variables de entorno." };
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const texto = await resp.text();
    let cuerpo: unknown = texto;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      // se queda como texto si no es JSON
    }
    return { url, status: resp.status, cuerpo };
  } catch (err) {
    return { url, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export default async function DiagnosticoPage() {
  await requerirAdmin();

  const vercelToken = process.env.VERCEL_API_TOKEN;
  const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = refSupabaseDesdeUrl();

  const resultados = await Promise.all([
    llamar("https://api.vercel.com/v9/projects", vercelToken),
    llamar("https://api.vercel.com/v2/user", vercelToken),
    llamar("https://api.supabase.com/v1/projects", supabaseToken),
    ref
      ? llamar(`https://api.supabase.com/v1/projects/${ref}`, supabaseToken)
      : Promise.resolve({ url: "(sin ref de Supabase)", error: "No se pudo leer NEXT_PUBLIC_SUPABASE_URL" }),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Diagnóstico de APIs (temporal)</h1>
        <p className="mt-1 text-sm text-gray-500">
          Esta pantalla es solo para ver la forma real de las respuestas de Vercel y Supabase antes
          de construir el panel definitivo. Se borra después.
        </p>
      </div>

      {resultados.map((r, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-4">
          <p className="mb-2 font-mono text-xs text-gray-500">{r.url}</p>
          {"error" in r && r.error ? (
            <p className="text-sm text-red-600">{r.error}</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-400">Status: {"status" in r ? r.status : "?"}</p>
              <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                {JSON.stringify("cuerpo" in r ? r.cuerpo : null, null, 2)}
              </pre>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
