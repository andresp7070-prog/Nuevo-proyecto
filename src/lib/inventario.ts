import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function reemplazarReceta(
  supabase: SupabaseClient,
  itemResultanteId: string,
  lineas: { insumoId: string; cantidad: number }[],
) {
  const insumoIds = lineas.map((linea) => linea.insumoId);
  if (new Set(insumoIds).size !== insumoIds.length) {
    throw new Error("No puedes elegir el mismo insumo dos veces en la receta.");
  }

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

// En cuántos días se acabaría el stock actual, al ritmo de venta reciente
// (vista_velocidad_ventas). null = no hay suficiente historial de ventas
// para estimarlo todavía.
export function calcularDiasRestantes(
  cantidad: number,
  unidadesPorDia: number | null | undefined,
): number | null {
  if (!unidadesPorDia || unidadesPorDia <= 0) return null;
  return Math.floor(cantidad / unidadesPorDia);
}

// Promedio de días entre una venta de este producto y la siguiente — "cada
// cuánto se vende", sin importar cuántas unidades salieron cada vez (a
// diferencia de vista_velocidad_ventas, que mide unidades por día). null =
// no hay al menos dos ventas distintas para calcular un intervalo.
export function promedioDiasEntreVentas(fechasVentaMs: number[]): number | null {
  if (fechasVentaMs.length < 2) return null;
  const ordenadas = [...fechasVentaMs].sort((a, b) => a - b);
  let sumaDias = 0;
  for (let i = 1; i < ordenadas.length; i++) {
    sumaDias += (ordenadas[i] - ordenadas[i - 1]) / (1000 * 60 * 60 * 24);
  }
  return sumaDias / (ordenadas.length - 1);
}
