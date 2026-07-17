import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerContextoPunto } from "@/lib/puntos";
import { VentasTabs } from "./ventas-tabs";
import { DescargarCsv } from "@/components/descargar-csv";

type ItemLinea = {
  cantidad: number;
  nombre_libre: string | null;
  inventario_items: { nombre: string } | null;
};

type Venta = {
  id: string;
  fecha: string;
  monto: number;
  cliente_nombre: string | null;
  metodo_pago: string | null;
  ventas_items: ItemLinea[];
};

const etiquetaMetodoPago: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  otro: "Otro",
};

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ guardada?: string }>;
}) {
  const { guardada } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, punto_venta_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { puntoSeleccionado } = await obtenerContextoPunto(
    supabase,
    perfil.empresa_id,
    perfil.punto_venta_id,
  );

  let query = supabase
    .from("ventas")
    .select(
      "id, fecha, monto, cliente_nombre, metodo_pago, ventas_items ( cantidad, nombre_libre, inventario_items ( nombre ) )",
    )
    .eq("empresa_id", perfil.empresa_id)
    .order("fecha", { ascending: false });

  if (puntoSeleccionado) query = query.eq("punto_venta_id", puntoSeleccionado);

  const { data } = await query;

  const ventas = (data ?? []) as unknown as Venta[];

  const diaColombia = (fechaIso: string) =>
    new Date(fechaIso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const ventasHoy = ventas.filter((venta) => diaColombia(venta.fecha) === hoy);
  const totalVentasHoy = ventasHoy.length;
  const totalVendidoHoy = ventasHoy.reduce((suma, venta) => suma + Number(venta.monto), 0);

  const vendidoPorDia: Record<string, number> = {};
  for (const venta of ventas) {
    const dia = diaColombia(venta.fecha);
    vendidoPorDia[dia] = (vendidoPorDia[dia] ?? 0) + Number(venta.monto);
  }
  const diasAnteriores = Object.entries(vendidoPorDia).filter(([dia]) => dia !== hoy);
  const promedioDiario =
    diasAnteriores.length > 0
      ? diasAnteriores.reduce((suma, [, monto]) => suma + monto, 0) / diasAnteriores.length
      : null;

  const diferenciaPromedio =
    promedioDiario !== null && promedioDiario > 0
      ? Math.round(((totalVendidoHoy - promedioDiario) / promedioDiario) * 100)
      : null;

  const filasCsv = ventas.map((venta) => ({
    fecha: new Date(venta.fecha).toLocaleString("es-CO"),
    cliente: venta.cliente_nombre ?? "",
    monto: Number(venta.monto),
    metodo_pago: venta.metodo_pago ? (etiquetaMetodoPago[venta.metodo_pago] ?? venta.metodo_pago) : "",
    productos: venta.ventas_items
      .map(
        (item) =>
          `${item.inventario_items?.nombre ?? item.nombre_libre ?? "Producto eliminado"} x${item.cantidad}`,
      )
      .join("; "),
  }));

  return (
    <div>
      <VentasTabs />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Ventas</h1>
        <div className="flex gap-2">
          <DescargarCsv
            filas={filasCsv}
            columnas={[
              { clave: "fecha", titulo: "Fecha" },
              { clave: "cliente", titulo: "Cliente" },
              { clave: "monto", titulo: "Monto" },
              { clave: "metodo_pago", titulo: "Método de pago" },
              { clave: "productos", titulo: "Productos" },
            ]}
            nombreArchivo="ventas.csv"
          />
          <Link
            href="/ventas/nueva"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Agregar venta
          </Link>
        </div>
      </div>

      {guardada === "1" && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Venta registrada correctamente.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:w-96">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Ventas de hoy</p>
          <p className="text-lg font-semibold text-gray-900">{totalVentasHoy}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Vendido hoy</p>
          <p className="text-lg font-semibold text-gray-900">
            {totalVendidoHoy.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
          </p>
          {diferenciaPromedio !== null ? (
            <p
              className={`mt-1 text-xs font-medium ${
                diferenciaPromedio > 0
                  ? "text-green-600"
                  : diferenciaPromedio < 0
                    ? "text-red-600"
                    : "text-gray-400"
              }`}
            >
              {diferenciaPromedio > 0 && `▲ ${diferenciaPromedio}% sobre el promedio`}
              {diferenciaPromedio < 0 && `▼ ${Math.abs(diferenciaPromedio)}% bajo el promedio`}
              {diferenciaPromedio === 0 && "Igual al promedio"}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">Aún no hay suficientes días para comparar</p>
          )}
        </div>
      </div>

      {ventas.length === 0 ? (
        <p className="text-gray-400">Todavía no hay ventas registradas.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {ventas.map((venta) => {
            const productos = venta.ventas_items
              .map(
                (item) =>
                  `${item.inventario_items?.nombre ?? item.nombre_libre ?? "Producto eliminado"} ×${item.cantidad}`,
              )
              .join(", ");

            return (
              <li key={venta.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {venta.cliente_nombre ?? "Cliente sin nombre"}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(venta.fecha).toLocaleString("es-CO")}</p>
                  <p className="mt-1 text-xs text-gray-500">{productos || "Sin productos"}</p>
                </div>
                <div className="text-right">
                  <span className="whitespace-nowrap font-medium text-gray-900">
                    {Number(venta.monto).toLocaleString("es-CO", {
                      style: "currency",
                      currency: "COP",
                    })}
                  </span>
                  {venta.metodo_pago && (
                    <p className="text-xs text-gray-400">
                      {etiquetaMetodoPago[venta.metodo_pago] ?? venta.metodo_pago}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
