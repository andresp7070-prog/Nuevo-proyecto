import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { primeraMayuscula } from "@/lib/texto";
import { obtenerContextoPunto } from "@/lib/puntos";
import { VentasTabs } from "../ventas-tabs";

type FilaMes = {
  mes: string;
  ingresos_por_ventas: number;
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function etiquetaMes(mes: string) {
  return primeraMayuscula(
    new Date(mes).toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
  );
}

function mesSiguiente(mes: string) {
  const fecha = new Date(mes);
  fecha.setUTCMonth(fecha.getUTCMonth() + 1);
  return etiquetaMes(fecha.toISOString());
}

export default async function ProyeccionesVentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, punto_venta_id, empresas ( permite_apartados )")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  // La relación empresa_id -> empresas.id es uno-a-uno; Supabase la tipa como
  // arreglo por falta de tipos generados, pero en tiempo de ejecución es un objeto.
  const empresa = perfil.empresas as unknown as { permite_apartados: boolean } | null;

  const { puntoSeleccionado } = await obtenerContextoPunto(
    supabase,
    perfil.empresa_id,
    perfil.punto_venta_id,
  );

  let query = supabase
    .from("vista_estado_resultados")
    .select("mes, punto_venta_id, ingresos_por_ventas")
    .eq("empresa_id", perfil.empresa_id)
    .order("mes", { ascending: false });

  if (puntoSeleccionado) query = query.eq("punto_venta_id", puntoSeleccionado);

  const { data } = await query;
  const filasCrudas = (data ?? []) as (FilaMes & { punto_venta_id: string | null })[];

  // Con "todos los puntos", la vista trae una fila por mes y punto — hay
  // que sumarlas para tener el ingreso combinado de cada mes, como antes.
  let meses: FilaMes[];
  if (puntoSeleccionado) {
    meses = filasCrudas.slice(0, 3);
  } else {
    const combinadoPorMes = new Map<string, FilaMes>();
    for (const f of filasCrudas) {
      const clave = f.mes.slice(0, 7);
      const acumulado = combinadoPorMes.get(clave) ?? { mes: f.mes, ingresos_por_ventas: 0 };
      acumulado.ingresos_por_ventas += Number(f.ingresos_por_ventas);
      combinadoPorMes.set(clave, acumulado);
    }
    meses = Array.from(combinadoPorMes.values())
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 3);
  }
  const promedio =
    meses.length > 0
      ? meses.reduce((suma, f) => suma + f.ingresos_por_ventas, 0) / meses.length
      : 0;

  return (
    <div>
      <VentasTabs permiteApartados={Boolean(empresa?.permite_apartados)} />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Proyecciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          Promedio de los últimos {meses.length || 0} mes{meses.length === 1 ? "" : "es"} con
          ventas, proyectado hacia el próximo mes.
        </p>
      </div>

      {meses.length === 0 ? (
        <p className="text-gray-400">
          Todavía no hay suficientes ventas registradas para proyectar.
        </p>
      ) : (
        <>
          <div className="mb-6 max-w-sm rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Ventas proyectadas para {mesSiguiente(meses[0].mes)}</p>
            <p className="text-2xl font-semibold text-gray-900">{formatoMoneda(promedio)}</p>
          </div>

          <div className="max-w-sm rounded-xl border border-gray-200 p-4">
            <p className="mb-2 text-xs font-medium text-gray-700">Basado en:</p>
            <ul className="divide-y divide-gray-100 text-sm">
              {meses.map((f) => (
                <li key={f.mes} className="flex justify-between py-1.5">
                  <span className="text-gray-500">{etiquetaMes(f.mes)}</span>
                  <span className="text-gray-900">{formatoMoneda(f.ingresos_por_ventas)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
