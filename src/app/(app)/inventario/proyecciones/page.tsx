import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { etiquetaUnidad } from "@/lib/unidades";
import { calcularMaxProducible } from "@/lib/inventario";
import { InventarioTabs } from "../inventario-tabs";

type Item = {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  cantidad: number;
  tipo: string;
};

type RecetaFila = {
  item_resultante_id: string;
  cantidad_insumo: number;
  inventario_items: { cantidad: number } | null;
};

type Velocidad = {
  item_id: string;
  unidades_por_dia: number;
};

export default async function ProyeccionesInventarioPage() {
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

  const { data: itemsData } = await supabase
    .from("inventario_items")
    .select("id, nombre, categoria, unidad, cantidad, tipo")
    .eq("empresa_id", perfil.empresa_id)
    .eq("tipo", "producto")
    .order("nombre");

  const items = (itemsData ?? []) as Item[];
  const itemIds = items.map((item) => item.id);

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

  const { data: velocidadData } =
    itemIds.length > 0
      ? await supabase
          .from("vista_velocidad_ventas")
          .select("item_id, unidades_por_dia")
          .eq("empresa_id", perfil.empresa_id)
          .in("item_id", itemIds)
      : { data: [] };

  const velocidadPorItem = new Map(
    ((velocidadData ?? []) as Velocidad[]).map((v) => [v.item_id, v.unidades_por_dia]),
  );

  const filas = items.map((item) => {
    const maxProducible = calcularMaxProducible(recetaPorItem[item.id] ?? []);
    const disponible = maxProducible !== null ? maxProducible : item.cantidad;
    const velocidad = velocidadPorItem.get(item.id) ?? 0;
    const diasRestantes = velocidad > 0 ? disponible / velocidad : null;
    return { item, disponible, velocidad, diasRestantes };
  });

  const conVentasRecientes = filas
    .filter((f) => f.velocidad > 0)
    .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));

  const sinVentasRecientes = filas.filter((f) => f.velocidad === 0);

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Proyecciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          Según tu ritmo de venta de los últimos 30 días, cuántos días de stock te quedan de
          cada producto.
        </p>
      </div>

      {conVentasRecientes.length === 0 ? (
        <p className="text-gray-400">
          Todavía no hay suficientes ventas recientes para proyectar el inventario.
        </p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-400">
              <tr>
                <th className="p-3 font-medium">Producto</th>
                <th className="p-3 font-medium">Disponible</th>
                <th className="p-3 font-medium">Venta reciente</th>
                <th className="p-3 font-medium">Días de stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conVentasRecientes.map(({ item, disponible, velocidad, diasRestantes }) => (
                <tr key={item.id}>
                  <td className="p-3">
                    <Link href={`/inventario/${item.id}`} className="text-gray-900 hover:underline">
                      {item.nombre}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-700">
                    {disponible} {etiquetaUnidad(item.unidad)}
                  </td>
                  <td className="p-3 text-gray-700">
                    {velocidad.toLocaleString("es-CO", { maximumFractionDigits: 2 })}/día
                  </td>
                  <td
                    className={`p-3 font-medium ${
                      diasRestantes !== null && diasRestantes <= 7
                        ? "text-red-600"
                        : diasRestantes !== null && diasRestantes <= 15
                          ? "text-amber-600"
                          : "text-gray-900"
                    }`}
                  >
                    {diasRestantes !== null ? `${Math.floor(diasRestantes)} días` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sinVentasRecientes.length > 0 && (
        <p className="text-xs text-gray-400">
          Sin ventas en los últimos 30 días (no se puede proyectar):{" "}
          {sinVentasRecientes.map((f) => f.item.nombre).join(", ")}
        </p>
      )}
    </div>
  );
}
