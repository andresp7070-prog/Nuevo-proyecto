import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectorioInventario } from "./directorio-inventario";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string }>;
}) {
  const { creado } = await searchParams;

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
    .select("id, nombre, categoria, cantidad, costo, precio_venta, marca:atributos->>marca")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  return <DirectorioInventario items={items ?? []} creado={creado === "1"} />;
}
