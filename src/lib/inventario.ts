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

// Cuántas unidades del producto resultante se pueden armar ahora mismo,
// según el stock disponible de cada insumo y cuánto pide la receta de cada
// uno — el insumo más escaso es el que manda. null = sin receta, sin límite.
export function calcularMaxProducible(
  receta: { cantidadInsumo: number; stockInsumo: number }[],
): number | null {
  if (receta.length === 0) return null;
  const posibles = receta
    .filter((fila) => fila.cantidadInsumo > 0)
    .map((fila) => Math.floor(fila.stockInsumo / fila.cantidadInsumo));
  if (posibles.length === 0) return null;
  return Math.max(0, Math.min(...posibles));
}
