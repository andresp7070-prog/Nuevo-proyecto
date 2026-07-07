import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { calcularMaxProducible } from "@/lib/inventario";
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
    .select("id, nombre, categoria, unidad, cantidad, costo, precio_venta, marca:atributos->>marca")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const itemIds = (items ?? []).map((item) => item.id);

  type RecetaFila = {
    item_resultante_id: string;
    cantidad_insumo: number;
    inventario_items: { cantidad: number } | null;
  };

  const { data: recetaRowsRaw } =
    itemIds.length > 0
      ? await supabase
          .from("inventario_receta")
          .select(
            "item_resultante_id, cantidad_insumo, inventario_items!inventario_receta_item_insumo_id_fkey ( cantidad )",
          )
          .in("item_resultante_id", itemIds)
      : { data: [] };

  const recetaRows = (recetaRowsRaw ?? []) as unknown as RecetaFila[];

  const recetaPorItem: Record<string, { cantidadInsumo: number; stockInsumo: number }[]> = {};
  for (const fila of recetaRows) {
    const lista = recetaPorItem[fila.item_resultante_id] ?? [];
    lista.push({ cantidadInsumo: fila.cantidad_insumo, stockInsumo: fila.inventario_items?.cantidad ?? 0 });
    recetaPorItem[fila.item_resultante_id] = lista;
  }

  const itemsConDisponible = (items ?? []).map((item) => ({
    ...item,
    disponible: calcularMaxProducible(recetaPorItem[item.id] ?? []),
  }));

  return <DirectorioInventario items={itemsConDisponible} creado={creado === "1"} />;
}
