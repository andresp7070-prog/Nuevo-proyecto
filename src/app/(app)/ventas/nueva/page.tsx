import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NuevaVentaForm } from "./nueva-venta-form";

export default async function NuevaVentaPage() {
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

  const { data: items } = await supabase
    .from("inventario_items")
    .select("id, nombre, precio_venta, marca:atributos->>marca")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const { data: empresa } = await supabase
    .from("empresas")
    .select("metodos_pago_disponibles")
    .eq("id", perfil.empresa_id)
    .single();

  return (
    <NuevaVentaForm
      items={items ?? []}
      metodosPago={empresa?.metodos_pago_disponibles ?? []}
    />
  );
}
