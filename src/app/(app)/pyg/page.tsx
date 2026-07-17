import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerContextoPunto } from "@/lib/puntos";
import { PygTabs } from "./pyg-tabs";
import { SelectorMesPyg } from "./selector-mes";
import { DescargarCsv } from "@/components/descargar-csv";
import { PagoRapidoDeuda } from "./pago-rapido-deuda";

type FilaResultados = {
  mes: string;
  ingresos_por_ventas: number;
  costo_de_ventas: number;
  utilidad_bruta: number;
  otros_ingresos: number;
  gastos_operacionales: number;
  utilidad_neta: number;
};

type Pasivo = {
  id: string;
  descripcion: string;
  tipo: string | null;
  monto_total: number;
  monto_pagado: number;
  fecha_vencimiento: string | null;
  estado: string;
};

type FilaCategoria = {
  categoria: string | null;
  unidades_vendidas: number;
  ingresos: number;
  costos: number;
  utilidad: number;
  margen_porcentaje: number;
};

type FilaProducto = FilaCategoria & {
  item_id: string;
  nombre: string;
  tipo: string;
};

function formatoMoneda(valor: number | null | undefined) {
  return (valor ?? 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function inicioMesActual() {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1)).toISOString();
}

export default async function PygPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;

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

  const { puntoSeleccionado, puntosVenta } = await obtenerContextoPunto(
    supabase,
    perfil.empresa_id,
    perfil.punto_venta_id,
  );
  const empresaUsaPuntos = puntosVenta.length > 0;

  let resultadosQuery = supabase
    .from("vista_estado_resultados")
    .select(
      "mes, punto_venta_id, ingresos_por_ventas, costo_de_ventas, utilidad_bruta, otros_ingresos, gastos_operacionales, utilidad_neta",
    )
    .eq("empresa_id", perfil.empresa_id)
    .order("mes", { ascending: false });

  if (puntoSeleccionado) resultadosQuery = resultadosQuery.eq("punto_venta_id", puntoSeleccionado);

  const { data: filasResultadosRaw } = await resultadosQuery;

  // Con un punto específico seleccionado, la vista ya trae una sola fila por
  // mes (filtrada). Con "todos los puntos", la vista ahora puede traer una
  // fila por cada combinación mes+punto — hay que sumarlas para volver a
  // tener el total combinado de toda la empresa, como antes de que existieran
  // los puntos de venta.
  const filasCrudas = (filasResultadosRaw ?? []) as (FilaResultados & {
    punto_venta_id: string | null;
  })[];

  let filas: FilaResultados[];
  if (puntoSeleccionado) {
    filas = filasCrudas;
  } else {
    const combinadoPorMes = new Map<string, FilaResultados>();
    for (const f of filasCrudas) {
      const clave = f.mes.slice(0, 7);
      const acumulado = combinadoPorMes.get(clave) ?? {
        mes: f.mes,
        ingresos_por_ventas: 0,
        costo_de_ventas: 0,
        utilidad_bruta: 0,
        otros_ingresos: 0,
        gastos_operacionales: 0,
        utilidad_neta: 0,
      };
      acumulado.ingresos_por_ventas += Number(f.ingresos_por_ventas);
      acumulado.costo_de_ventas += Number(f.costo_de_ventas);
      acumulado.utilidad_bruta += Number(f.utilidad_bruta);
      acumulado.otros_ingresos += Number(f.otros_ingresos);
      acumulado.gastos_operacionales += Number(f.gastos_operacionales);
      acumulado.utilidad_neta += Number(f.utilidad_neta);
      combinadoPorMes.set(clave, acumulado);
    }
    filas = Array.from(combinadoPorMes.values()).sort((a, b) => b.mes.localeCompare(a.mes));
  }

  const mesSeleccionado = mes ?? filas[0]?.mes ?? inicioMesActual();
  const fila =
    filas.find((f) => f.mes.slice(0, 7) === mesSeleccionado.slice(0, 7)) ??
    ({
      mes: mesSeleccionado,
      ingresos_por_ventas: 0,
      costo_de_ventas: 0,
      utilidad_bruta: 0,
      otros_ingresos: 0,
      gastos_operacionales: 0,
      utilidad_neta: 0,
    } as FilaResultados);

  const mesesConDatos = filas.map((f) => f.mes.slice(0, 7));

  const { data: pasivosData } = await supabase
    .from("pasivos")
    .select("id, descripcion, tipo, monto_total, monto_pagado, fecha_vencimiento, estado")
    .eq("empresa_id", perfil.empresa_id)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  const pasivos = (pasivosData ?? []) as Pasivo[];
  const totalPendiente = pasivos
    .filter((p) => p.estado !== "pagado")
    .reduce((suma, p) => suma + (p.monto_total - p.monto_pagado), 0);

  const { data: porCategoriaData } = await supabase
    .from("vista_utilidad_por_categoria")
    .select("categoria, unidades_vendidas, ingresos, costos, utilidad, margen_porcentaje")
    .eq("empresa_id", perfil.empresa_id)
    .order("utilidad", { ascending: false });

  const porCategoria = (porCategoriaData ?? []) as FilaCategoria[];

  const { data: porProductoData } = await supabase
    .from("vista_utilidad_por_producto")
    .select(
      "item_id, nombre, tipo, categoria, unidades_vendidas, ingresos, costos, utilidad, margen_porcentaje",
    )
    .eq("empresa_id", perfil.empresa_id)
    .order("utilidad", { ascending: false });

  const porProducto = (porProductoData ?? []) as FilaProducto[];

  const filasCsvCategoria = porCategoria.map((c) => ({
    categoria: c.categoria || "Sin categoría",
    unidades: c.unidades_vendidas,
    ingresos: c.ingresos,
    costos: c.costos,
    utilidad: c.utilidad,
    margen: c.margen_porcentaje,
  }));

  const filasCsvProducto = porProducto.map((p) => ({
    producto: p.nombre,
    unidades: p.unidades_vendidas,
    ingresos: p.ingresos,
    costos: p.costos,
    utilidad: p.utilidad,
    margen: p.margen_porcentaje,
  }));

  return (
    <div className="space-y-6">
      <PygTabs />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Estado de pérdidas y ganancias</h1>
        <div className="flex gap-2">
          <Link
            href="/pyg/movimientos/nuevo"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Agregar gasto o ingreso
          </Link>
          <Link
            href="/pyg/pasivos"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Deudas
          </Link>
        </div>
      </div>

      <SelectorMesPyg mesesConDatos={mesesConDatos} mesSeleccionado={mesSeleccionado} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Utilidad</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Ingresos por ventas</dt>
              <dd className="text-gray-900">{formatoMoneda(fila.ingresos_por_ventas)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Costo de ventas</dt>
              <dd className="text-gray-900">− {formatoMoneda(fila.costo_de_ventas)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-medium">
              <dt className="text-gray-700">Utilidad bruta</dt>
              <dd className="text-gray-900">{formatoMoneda(fila.utilidad_bruta)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Otros ingresos</dt>
              <dd className="text-gray-900">+ {formatoMoneda(fila.otros_ingresos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Gastos operacionales</dt>
              <dd className="text-gray-900">− {formatoMoneda(fila.gastos_operacionales)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
              <dt className="text-gray-900">Utilidad neta</dt>
              <dd className={fila.utilidad_neta >= 0 ? "text-green-700" : "text-red-600"}>
                {formatoMoneda(fila.utilidad_neta)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Deudas pendientes</h2>
            <Link href="/pyg/pasivos" className="text-xs text-gray-500 hover:text-gray-700">
              Ver todas
            </Link>
          </div>
          <p className="text-base font-semibold text-gray-900">{formatoMoneda(totalPendiente)}</p>
          <p className="mb-3 text-xs text-gray-400">
            No hace parte de la utilidad — es dinero que debes, se muestra aparte.
          </p>
          {pasivos.filter((p) => p.estado !== "pagado").length === 0 ? (
            <p className="text-sm text-gray-400">No tienes deudas pendientes registradas.</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 text-sm">
                {pasivos
                  .filter((p) => p.estado !== "pagado")
                  .slice(0, 5)
                  .map((p) => (
                    <li key={p.id} className="flex justify-between py-1.5">
                      <span className="text-gray-700">{p.descripcion}</span>
                      <span className="text-gray-900">
                        {formatoMoneda(p.monto_total - p.monto_pagado)}
                      </span>
                    </li>
                  ))}
              </ul>
              <PagoRapidoDeuda pasivos={pasivos.filter((p) => p.estado !== "pagado")} />
            </>
          )}
        </div>
      </div>

      {empresaUsaPuntos && (
        <p className="text-xs text-gray-400">
          Las tablas de utilidad por categoría y por producto, abajo, siempre muestran el total de
          todos los puntos combinados — todavía no se pueden filtrar por punto.
        </p>
      )}

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Utilidad por categoría</h2>
          <DescargarCsv
            filas={filasCsvCategoria}
            columnas={[
              { clave: "categoria", titulo: "Categoría" },
              { clave: "unidades", titulo: "Unidades" },
              { clave: "ingresos", titulo: "Ingresos" },
              { clave: "costos", titulo: "Costos" },
              { clave: "utilidad", titulo: "Utilidad" },
              { clave: "margen", titulo: "Margen %" },
            ]}
            nombreArchivo="utilidad-por-categoria.csv"
          />
        </div>
        {porCategoria.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="pb-2 font-medium">Categoría</th>
                  <th className="pb-2 font-medium">Unidades</th>
                  <th className="pb-2 font-medium">Ingresos</th>
                  <th className="pb-2 font-medium">Costos</th>
                  <th className="pb-2 font-medium">Utilidad</th>
                  <th className="pb-2 font-medium">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {porCategoria.map((c, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-900">{c.categoria || "Sin categoría"}</td>
                    <td className="py-2 text-gray-700">{c.unidades_vendidas}</td>
                    <td className="py-2 text-gray-700">{formatoMoneda(c.ingresos)}</td>
                    <td className="py-2 text-gray-700">{formatoMoneda(c.costos)}</td>
                    <td className="py-2 text-gray-900">{formatoMoneda(c.utilidad)}</td>
                    <td className="py-2 text-gray-700">{c.margen_porcentaje}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Utilidad por producto</h2>
          <DescargarCsv
            filas={filasCsvProducto}
            columnas={[
              { clave: "producto", titulo: "Producto" },
              { clave: "unidades", titulo: "Unidades" },
              { clave: "ingresos", titulo: "Ingresos" },
              { clave: "costos", titulo: "Costos" },
              { clave: "utilidad", titulo: "Utilidad" },
              { clave: "margen", titulo: "Margen %" },
            ]}
            nombreArchivo="utilidad-por-producto.csv"
          />
        </div>
        {porProducto.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 font-medium">Unidades</th>
                  <th className="pb-2 font-medium">Ingresos</th>
                  <th className="pb-2 font-medium">Costos</th>
                  <th className="pb-2 font-medium">Utilidad</th>
                  <th className="pb-2 font-medium">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {porProducto.map((p) => (
                  <tr key={p.item_id}>
                    <td className="py-2 text-gray-900">{p.nombre}</td>
                    <td className="py-2 text-gray-700">{p.unidades_vendidas}</td>
                    <td className="py-2 text-gray-700">{formatoMoneda(p.ingresos)}</td>
                    <td className="py-2 text-gray-700">{formatoMoneda(p.costos)}</td>
                    <td className="py-2 text-gray-900">{formatoMoneda(p.utilidad)}</td>
                    <td className="py-2 text-gray-700">{p.margen_porcentaje}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
