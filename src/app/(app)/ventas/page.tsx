import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type ItemLinea = {
  cantidad: number;
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

  const { data } = await supabase
    .from("ventas")
    .select(
      "id, fecha, monto, cliente_nombre, metodo_pago, ventas_items ( cantidad, inventario_items ( nombre ) )",
    )
    .eq("empresa_id", perfil.empresa_id)
    .order("fecha", { ascending: false });

  const ventas = (data ?? []) as unknown as Venta[];
  const totalVentas = ventas.length;
  const totalVendido = ventas.reduce((suma, venta) => suma + Number(venta.monto), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Ventas</h1>
        <Link
          href="/ventas/nueva"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Agregar venta
        </Link>
      </div>

      {guardada === "1" && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Venta registrada correctamente.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:w-80">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Total de ventas</p>
          <p className="text-lg font-semibold text-gray-900">{totalVentas}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Total vendido</p>
          <p className="text-lg font-semibold text-gray-900">
            {totalVendido.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
          </p>
        </div>
      </div>

      {ventas.length === 0 ? (
        <p className="text-gray-400">Todavía no hay ventas registradas.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {ventas.map((venta) => {
            const productos = venta.ventas_items
              .map((item) => `${item.inventario_items?.nombre ?? "Producto eliminado"} ×${item.cantidad}`)
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
