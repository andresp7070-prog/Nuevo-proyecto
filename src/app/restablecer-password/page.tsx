import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { restablecerPassword } from "./actions";

export default async function RestablecerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Elige una contraseña nueva</h1>
        <p className="mb-6 text-sm text-gray-500">
          Después de guardarla, entras directo a la plataforma con la contraseña nueva.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <form action={restablecerPassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña nueva
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirmar" className="mb-1 block text-sm font-medium text-gray-700">
              Confirmar contraseña
            </label>
            <input
              id="confirmar"
              name="confirmar"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Guardar y entrar
          </button>
        </form>
      </div>
    </div>
  );
}
