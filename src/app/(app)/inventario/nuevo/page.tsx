import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NuevoProductoForm } from "./nuevo-producto-form";

export default async function NuevoProductoPage() {
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

  const itemIds = (items ?? []).map((item) => item.id);

  const { data: recetaRows } =
    itemIds.length > 0
      ? await supabase
          .from("inventario_receta")
          .select("item_resultante_id, item_insumo_id, cantidad_insumo")
          .in("item_resultante_id", itemIds)
      : { data: [] as { item_resultante_id: string; item_insumo_id: string; cantidad_insumo: number }[] };

  const recetasPorItem: Record<string, { insumoId: string; cantidad: number }[]> = {};
  for (const fila of recetaRows ?? []) {
    const lista = recetasPorItem[fila.item_resultante_id] ?? [];
    lista.push({ insumoId: fila.item_insumo_id, cantidad: fila.cantidad_insumo });
    recetasPorItem[fila.item_resultante_id] = lista;
  }

  return <NuevoProductoForm items={items ?? []} recetasPorItem={recetasPorItem} />;
}
