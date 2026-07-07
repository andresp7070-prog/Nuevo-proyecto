import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { etiquetaUnidad } from "@/lib/unidades";

type RecetaFila = {
  cantidad_insumo: number;
  inventario_items: { nombre: string; unidad: string } | null;
};

function formatoMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

export default async function FichaProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: item } = await supabase
    .from("inventario_items")
    .select(
      "id, nombre, categoria, unidad, cantidad, costo, precio_venta, marca:atributos->>marca, contenido_por_unidad:atributos->>contenido_por_unidad",
    )
    .eq("id", id)
    .single();

  if (!item) notFound();

  const { data } = await supabase
    .from("inventario_receta")
    .select("cantidad_insumo, inventario_items!inventario_receta_item_insumo_id_fkey ( nombre, unidad )")
    .eq("item_resultante_id", id);

  const receta = (data ?? []) as unknown as RecetaFila[];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{item.nombre}</h1>
            <p className="text-sm text-gray-500">
              {[item.categoria, item.marca].filter(Boolean).join(" · ") || "Sin categoría"}
            </p>
            {item.contenido_por_unidad && (
              <p className="mt-1 text-xs text-gray-400">
                Cada unidad: {item.contenido_por_unidad} {etiquetaUnidad(item.unidad)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/inventario/${item.id}/receta`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Configurar receta
            </Link>
            <Link
              href={`/inventario/${item.id}/producir`}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Producir
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Cantidad en stock</p>
            <p className="font-medium text-gray-900">
              {item.cantidad} {etiquetaUnidad(item.unidad)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Costo por unidad</p>
            <p className="font-medium text-gray-900">{formatoMoneda(item.costo)}</p>
          </div>
          <div>
            <p className="text-gray-400">Precio de venta</p>
            <p className="font-medium text-gray-900">{formatoMoneda(item.precio_venta)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Receta</h2>
        {receta.length === 0 ? (
          <p className="text-sm text-gray-400">
            Este producto no tiene receta configurada — &ldquo;Producir&rdquo; solo sumará al
            stock, sin descontar insumos.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {receta.map((fila, i) => (
              <li key={i} className="py-2 text-sm text-gray-900">
                {fila.cantidad_insumo}{" "}
                {fila.inventario_items ? etiquetaUnidad(fila.inventario_items.unidad) : ""} de{" "}
                {fila.inventario_items?.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
