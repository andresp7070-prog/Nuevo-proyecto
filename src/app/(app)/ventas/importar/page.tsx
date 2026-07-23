import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VentasTabs } from "../ventas-tabs";
import { ImportarVentasForm } from "./importar-ventas-form";

export default async function ImportarVentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, empresas ( permite_apartados )")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  // La relación empresa_id -> empresas.id es uno-a-uno; Supabase la tipa como
  // arreglo por falta de tipos generados, pero en tiempo de ejecución es un objeto.
  const empresa = perfil.empresas as unknown as { permite_apartados: boolean } | null;

  const { data: items } = await supabase
    .from("inventario_items")
    .select("nombre")
    .eq("empresa_id", perfil.empresa_id);

  return (
    <div>
      <VentasTabs permiteApartados={Boolean(empresa?.permite_apartados)} />
      <ImportarVentasForm nombresProductos={(items ?? []).map((i) => i.nombre)} />
    </div>
  );
}
