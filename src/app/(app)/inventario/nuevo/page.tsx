import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NuevoProductoForm } from "./nuevo-producto-form";

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ nombre?: string; volver?: string }>;
}) {
  const { nombre, volver } = await searchParams;

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
    .select("id, nombre, categoria, cantidad, costo, precio_venta, unidad")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  return (
    <NuevoProductoForm
      items={items ?? []}
      nombreInicial={nombre ?? ""}
      volverAReceta={volver === "receta"}
    />
  );
}
