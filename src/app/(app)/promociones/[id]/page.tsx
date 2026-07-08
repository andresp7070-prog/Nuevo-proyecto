import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

type Promocion = {
  id: string;
  nombre: string;
  codigo: string | null;
  tipo_promocion: string;
  valor: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  aplica_a_categoria: string | null;
  producto: { nombre: string } | null;
  regalo: { nombre: string } | null;
};

type Efectividad = {
  ventas_con_este_descuento: number;
  ingresos_de_esas_ventas: number;
  ticket_promedio: number;
  unidades_con_descuento: number;
  descuento_total_otorgado: number;
  ventas_totales_del_periodo: number;
};

const etiquetaTipo: Record<string, string> = {
  descuento_porcentaje: "Descuento %",
  descuento_fijo: "Descuento fijo",
  "2x1": "2x1",
  lleve_x_gratis: "Lleve X gratis",
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function estadoPromocion(p: Promocion) {
  if (!p.activo) return { etiqueta: "Desactivada", clase: "text-gray-400" };
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy < p.fecha_inicio) return { etiqueta: "Programada", clase: "text-amber-600" };
  if (hoy > p.fecha_fin) return { etiqueta: "Finalizada", clase: "text-gray-400" };
  return { etiqueta: "Activa ahora", clase: "text-green-700" };
}

export default async function PromocionDetallePage({
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

  const { data } = await supabase
    .from("promociones")
    .select(
      "id, nombre, codigo, tipo_promocion, valor, fecha_inicio, fecha_fin, activo, aplica_a_categoria, producto:inventario_items!promociones_aplica_a_item_id_fkey ( nombre ), regalo:inventario_items!promociones_item_regalo_id_fkey ( nombre )",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const promocion = data as unknown as Promocion;

  const { data: efectividadData } = await supabase
    .from("vista_efectividad_promociones")
    .select(
      "ventas_con_este_descuento, ingresos_de_esas_ventas, ticket_promedio, unidades_con_descuento, descuento_total_otorgado, ventas_totales_del_periodo",
    )
    .eq("promocion_id", id)
    .single();

  const efectividad = efectividadData as Efectividad | null;
  const estado = estadoPromocion(promocion);

  const aplicaA = promocion.producto
    ? `Producto: ${promocion.producto.nombre}`
    : promocion.aplica_a_categoria
      ? `Categoría: ${promocion.aplica_a_categoria}`
      : "Todo el catálogo";

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/promociones" className="text-sm text-gray-500 hover:text-gray-700">
        ← Volver a promociones
      </Link>

      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{promocion.nombre}</h1>
            <p className="text-sm text-gray-500">
              {[etiquetaTipo[promocion.tipo_promocion] ?? promocion.tipo_promocion, promocion.codigo]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className={`text-sm font-medium ${estado.clase}`}>{estado.etiqueta}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-gray-400">Período</p>
            <p className="font-medium text-gray-900">
              {promocion.fecha_inicio} a {promocion.fecha_fin}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Aplica a</p>
            <p className="font-medium text-gray-900">{aplicaA}</p>
          </div>
          {promocion.valor !== null && (
            <div>
              <p className="text-gray-400">Valor</p>
              <p className="font-medium text-gray-900">
                {promocion.tipo_promocion === "descuento_porcentaje"
                  ? `${promocion.valor}%`
                  : formatoMoneda(promocion.valor)}
              </p>
            </div>
          )}
          {promocion.regalo && (
            <div>
              <p className="text-gray-400">Producto regalado</p>
              <p className="font-medium text-gray-900">{promocion.regalo.nombre}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Desempeño</h2>
        {!efectividad || efectividad.ventas_con_este_descuento === 0 ? (
          <p className="text-sm text-gray-400">
            Todavía no se ha usado esta promoción en ninguna venta.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-400">Ventas con este descuento</dt>
              <dd className="font-medium text-gray-900">{efectividad.ventas_con_este_descuento}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Ingresos de esas ventas</dt>
              <dd className="font-medium text-gray-900">
                {formatoMoneda(efectividad.ingresos_de_esas_ventas)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Ticket promedio</dt>
              <dd className="font-medium text-gray-900">{formatoMoneda(efectividad.ticket_promedio)}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Unidades con descuento</dt>
              <dd className="font-medium text-gray-900">{efectividad.unidades_con_descuento}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Dinero regalado/descontado</dt>
              <dd className="font-medium text-gray-900">
                {formatoMoneda(efectividad.descuento_total_otorgado)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Ventas totales del período</dt>
              <dd className="font-medium text-gray-900">
                {formatoMoneda(efectividad.ventas_totales_del_periodo)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
