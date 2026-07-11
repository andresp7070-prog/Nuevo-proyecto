import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InventarioTabs } from "../inventario-tabs";
import { etiquetaFrecuenciaPago } from "@/lib/proveedores";

export default async function ProveedoresPage() {
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

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id, nombre, telefono, frecuencia_pago, dia_semana_pago, dias_personalizado")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Proveedores</h1>
        <Link
          href="/inventario/proveedores/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Agregar proveedor
        </Link>
      </div>

      {!proveedores || proveedores.length === 0 ? (
        <p className="text-gray-400">Todavía no tienes proveedores registrados.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {proveedores.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                <p className="text-xs text-gray-400">{p.telefono || "Sin teléfono"}</p>
              </div>
              <span className="text-sm text-gray-700">
                {etiquetaFrecuenciaPago(p.frecuencia_pago, p.dia_semana_pago, p.dias_personalizado)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
