import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AgregarAbonoForm } from "./agregar-abono-form";

export default async function ApartadoPage({
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

  const { data: apartado } = await supabase
    .from("apartados")
    .select(
      "id, cliente_nombre, cliente_telefono, cliente_email, monto_total, monto_abonado, fecha, fecha_limite, estado, venta_id",
    )
    .eq("id", id)
    .single();

  if (!apartado) notFound();

  const { data: items } = await supabase
    .from("apartados_items")
    .select("id, nombre_libre, cantidad, precio_unitario, inventario_items ( nombre )")
    .eq("apartado_id", id);

  const { data: abonos } = await supabase
    .from("apartados_abonos")
    .select("id, monto, fecha")
    .eq("apartado_id", id)
    .order("fecha", { ascending: false });

  function formatoMoneda(valor: number) {
    return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
  }

  const restante = apartado.monto_total - apartado.monto_abonado;

  const hoy = new Date().toISOString().slice(0, 10);
  const dias = Math.ceil(
    (new Date(apartado.fecha_limite).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24),
  );

  const etiquetaEstado: Record<string, string> = {
    activo: "Activo",
    reclamado: "Reclamado — prenda entregada",
    vencido: "Vencido — abono perdido, prenda disponible de nuevo",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/apartados" className="text-sm text-gray-500 hover:text-gray-700">
        ← Volver a Apartados
      </Link>

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {apartado.cliente_nombre ?? "Cliente sin nombre"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {apartado.cliente_telefono ?? "Sin teléfono"} · {apartado.cliente_email ?? "Sin correo"}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            {etiquetaEstado[apartado.estado] ?? apartado.estado}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Precio total</p>
            <p className="font-medium text-gray-900">{formatoMoneda(apartado.monto_total)}</p>
          </div>
          <div>
            <p className="text-gray-400">Abonado</p>
            <p className="font-medium text-gray-900">{formatoMoneda(apartado.monto_abonado)}</p>
          </div>
          <div>
            <p className="text-gray-400">Falta</p>
            <p className="font-medium text-gray-900">{formatoMoneda(Math.max(0, restante))}</p>
          </div>
        </div>

        {apartado.estado === "activo" && (
          <p className="mt-3 text-xs text-gray-400">
            Apartado el {new Date(apartado.fecha).toLocaleDateString("es-CO")} — plazo hasta el{" "}
            {new Date(apartado.fecha_limite).toLocaleDateString("es-CO")}
            {dias >= 0 ? ` (quedan ${dias} día(s))` : ` (venció hace ${Math.abs(dias)} día(s))`}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Prendas apartadas</h2>
        <ul className="divide-y divide-gray-200">
          {(items ?? []).map((item) => {
            // La relación item_id -> inventario_items.id es muchos-a-uno; Supabase la
            // tipa como arreglo por falta de tipos generados, pero en tiempo de
            // ejecución es un objeto.
            const producto = item.inventario_items as unknown as { nombre: string } | null;
            return (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-900">
                  {producto?.nombre ?? item.nombre_libre ?? "Producto"}
                </span>
                <span className="text-gray-500">
                  {item.cantidad} × {formatoMoneda(item.precio_unitario)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Abonos</h2>
        {abonos && abonos.length > 0 ? (
          <ul className="mb-4 divide-y divide-gray-200">
            {abonos.map((abono) => (
              <li key={abono.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-500">
                  {new Date(abono.fecha).toLocaleDateString("es-CO")}
                </span>
                <span className="font-medium text-gray-900">{formatoMoneda(abono.monto)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-gray-400">Sin abonos registrados todavía.</p>
        )}

        {apartado.estado === "activo" && (
          <AgregarAbonoForm apartadoId={apartado.id} maximo={Math.max(0, restante)} />
        )}
      </div>
    </div>
  );
}
