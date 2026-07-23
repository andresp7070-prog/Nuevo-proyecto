import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DirectorioMovimientos } from "./directorio-movimientos";

export default async function MovimientosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  // Los movimientos generados solos por un abono de deuda (pasivo_id no es
  // null) no aparecen acá — esos se ven y se corrigen desde Deudas, para no
  // desincronizarlos de lo que esa deuda tiene registrado como pagado.
  const { data: movimientos } = await supabase
    .from("finanzas_movimientos")
    .select("id, tipo, categoria, monto, fecha, nota, recurrente, frecuencia")
    .eq("empresa_id", perfil.empresa_id)
    .is("pasivo_id", null)
    .order("fecha", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/pyg" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a Estado P y G
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Gastos e ingresos</h1>
        </div>
        <Link
          href="/pyg/movimientos/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Agregar gasto o ingreso
        </Link>
      </div>

      <DirectorioMovimientos movimientos={movimientos ?? []} />
    </div>
  );
}
