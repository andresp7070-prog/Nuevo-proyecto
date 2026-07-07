import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function reemplazarReceta(
  supabase: SupabaseClient,
  itemResultanteId: string,
  lineas: { insumoId: string; cantidad: number }[],
) {
  const { error: errorBorrar } = await supabase
    .from("inventario_receta")
    .delete()
    .eq("item_resultante_id", itemResultanteId);

  if (errorBorrar) throw new Error(errorBorrar.message);

  if (lineas.length === 0) return;

  const { error: errorInsertar } = await supabase.from("inventario_receta").insert(
    lineas.map((linea) => ({
      item_resultante_id: itemResultanteId,
      item_insumo_id: linea.insumoId,
      cantidad_insumo: linea.cantidad,
    })),
  );

  if (errorInsertar) throw new Error(errorInsertar.message);
}
