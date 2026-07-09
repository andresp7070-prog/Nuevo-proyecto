import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { primeraMayuscula } from "@/lib/texto";
import { firmarFotoUrl } from "@/lib/fotos";
import { LogoEmpresa } from "./logo-empresa";

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function diaColombia(fechaIso: string) {
  return new Date(fechaIso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export default async function ResumenPage() {
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

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const mesActual = hoy.slice(0, 7);

  const [
    { data: empresa },
    { data: ventasData },
    { data: resultadosData },
    { data: pasivosData },
    { data: itemsAgotadosData },
  ] = await Promise.all([
    supabase.from("empresas").select("nombre, logo_path").eq("id", perfil.empresa_id).single(),
    supabase.from("ventas").select("fecha, monto").eq("empresa_id", perfil.empresa_id),
    supabase
      .from("vista_estado_resultados")
      .select("mes, utilidad_neta")
      .eq("empresa_id", perfil.empresa_id),
    supabase
      .from("pasivos")
      .select("monto_total, monto_pagado, estado")
      .eq("empresa_id", perfil.empresa_id),
    supabase
      .from("inventario_items")
      .select("id, nombre, cantidad, unidad")
      .eq("empresa_id", perfil.empresa_id)
      .eq("tipo", "producto")
      .lte("cantidad", 0)
      .order("nombre"),
  ]);

  // ---- Ventas de hoy ----
  const ventas = (ventasData ?? []) as { fecha: string; monto: number }[];
  const ventasHoy = ventas.filter((v) => diaColombia(v.fecha) === hoy);
  const totalVentasHoy = ventasHoy.length;
  const totalVendidoHoy = ventasHoy.reduce((suma, v) => suma + Number(v.monto), 0);

  const vendidoPorDia: Record<string, number> = {};
  for (const v of ventas) {
    const dia = diaColombia(v.fecha);
    vendidoPorDia[dia] = (vendidoPorDia[dia] ?? 0) + Number(v.monto);
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

  // ---- Utilidad neta del mes ----
  const resultados = (resultadosData ?? []) as { mes: string; utilidad_neta: number }[];
  const filaMes = resultados.find((f) => f.mes.slice(0, 7) === mesActual);
  const utilidadNetaMes = filaMes?.utilidad_neta ?? 0;

  // ---- Deudas pendientes ----
  const pasivos = (pasivosData ?? []) as { monto_total: number; monto_pagado: number; estado: string }[];
  const totalPendiente = pasivos
    .filter((p) => p.estado !== "pagado")
    .reduce((suma, p) => suma + (p.monto_total - p.monto_pagado), 0);

  // ---- Inventario agotado ----
  const itemsAgotados = (itemsAgotadosData ?? []) as { id: string; nombre: string; cantidad: number; unidad: string }[];

  const logoUrl = await firmarFotoUrl(supabase, empresa?.logo_path ?? null, "empresas-logos");

  const fechaLegible = primeraMayuscula(
    new Date().toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Hola, {empresa?.nombre ?? "bienvenido"}
          </h1>
          <p className="text-sm text-gray-400">{fechaLegible}</p>
        </div>
        <LogoEmpresa logoUrl={logoUrl} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Ventas de hoy</h2>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-gray-900">{formatoMoneda(totalVendidoHoy)}</p>
          </div>
          <p className="text-xs text-gray-400">{totalVentasHoy} venta(s) hoy</p>
          {diferenciaPromedio !== null ? (
            <p
              className={`mt-2 text-xs font-medium ${
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
            <p className="mt-2 text-xs text-gray-400">Aún no hay suficientes días para comparar</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Utilidad neta del mes</h2>
          <p
            className={`text-2xl font-semibold ${
              utilidadNetaMes >= 0 ? "text-gray-900" : "text-red-600"
            }`}
          >
            {formatoMoneda(utilidadNetaMes)}
          </p>
          <p className="text-xs text-gray-400">Deudas pendientes: {formatoMoneda(totalPendiente)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Inventario agotado</h2>
          <Link href="/inventario" className="text-xs text-gray-500 hover:text-gray-700">
            Ver inventario
          </Link>
        </div>
        {itemsAgotados.length === 0 ? (
          <p className="text-sm text-gray-400">Ningún producto está en cero — todo en orden.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {itemsAgotados.slice(0, 5).map((item) => (
              <li key={item.id} className="flex justify-between py-1.5">
                <span className="text-gray-700">{item.nombre}</span>
                <span className="text-red-600">Agotado</span>
              </li>
            ))}
          </ul>
        )}
        {itemsAgotados.length > 5 && (
          <p className="mt-2 text-xs text-gray-400">y {itemsAgotados.length - 5} más...</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Accesos directos</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/ventas/nueva"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Agregar venta
          </Link>
          <Link
            href="/crm/nuevo"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Agregar cliente
          </Link>
          <Link
            href="/inventario/nuevo"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Agregar producto
          </Link>
        </div>
      </div>
    </div>
  );
}
