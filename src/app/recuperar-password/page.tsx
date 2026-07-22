import Link from "next/link";
import { solicitarRecuperacion } from "./actions";

export default async function RecuperarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { enviado } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Recuperar contraseña</h1>
        <p className="mb-6 text-sm text-gray-500">
          Escribe el correo con el que ingresas — si existe una cuenta con ese correo, te
          enviamos un enlace para elegir una contraseña nueva.
        </p>

        {enviado === "1" ? (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Si ese correo tiene una cuenta, ya te llegó el enlace. Revisa tu bandeja de entrada
            (y la de spam, por si acaso).
          </p>
        ) : (
          <form action={solicitarRecuperacion} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Correo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Enviar enlace
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
