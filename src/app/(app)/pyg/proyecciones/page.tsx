import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { primeraMayuscula } from "@/lib/texto";
import { PygTabs } from "../pyg-tabs";

type FilaMes = {
  mes: string;
  ingresos_por_ventas: number;
  costo_de_ventas: number;
  utilidad_bruta: number;
  otros_ingresos: number;
  gastos_operacionales: number;
  utilidad_neta: number;
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

function promedio(valores: number[]) {
  if (valores.length === 0) return 0;
  return valores.reduce((suma, v) => suma + v, 0) / valores.length;
}

export default async function ProyeccionesPygPage() {
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
    .from("vista_estado_resultados")
    .select(
      "mes, ingresos_por_ventas, costo_de_ventas, utilidad_bruta, otros_ingresos, gastos_operacionales, utilidad_neta",
    )
    .eq("empresa_id", perfil.empresa_id)
    .order("mes", { ascending: false })
    .limit(3);

  const meses = (data ?? []) as FilaMes[];

  const proyeccion = {
    ingresos_por_ventas: promedio(meses.map((f) => f.ingresos_por_ventas)),
    costo_de_ventas: promedio(meses.map((f) => f.costo_de_ventas)),
    utilidad_bruta: promedio(meses.map((f) => f.utilidad_bruta)),
    otros_ingresos: promedio(meses.map((f) => f.otros_ingresos)),
    gastos_operacionales: promedio(meses.map((f) => f.gastos_operacionales)),
    utilidad_neta: promedio(meses.map((f) => f.utilidad_neta)),
  };

  return (
    <div className="space-y-6">
      <PygTabs />

      <div>
        <h1 className="text-lg font-semibold text-gray-900">Proyecciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          Promedio de los últimos {meses.length || 0} mes{meses.length === 1 ? "" : "es"},
          proyectado hacia el próximo mes.
        </p>
      </div>

      {meses.length === 0 ? (
        <p className="text-gray-400">
          Todavía no hay suficientes datos registrados para proyectar.
        </p>
      ) : (
        <>
          <div className="max-w-sm rounded-lg border border-gray-200 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              Proyección para {mesSiguiente(meses[0].mes)}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Ingresos por ventas</dt>
                <dd className="text-gray-900">{formatoMoneda(proyeccion.ingresos_por_ventas)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Costo de ventas</dt>
                <dd className="text-gray-900">− {formatoMoneda(proyeccion.costo_de_ventas)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 font-medium">
                <dt className="text-gray-700">Utilidad bruta</dt>
                <dd className="text-gray-900">{formatoMoneda(proyeccion.utilidad_bruta)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Otros ingresos</dt>
                <dd className="text-gray-900">+ {formatoMoneda(proyeccion.otros_ingresos)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Gastos operacionales</dt>
                <dd className="text-gray-900">
                  − {formatoMoneda(proyeccion.gastos_operacionales)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
                <dt className="text-gray-900">Utilidad neta proyectada</dt>
                <dd className={proyeccion.utilidad_neta >= 0 ? "text-green-700" : "text-red-600"}>
                  {formatoMoneda(proyeccion.utilidad_neta)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="max-w-sm rounded-lg border border-gray-200 p-4">
            <p className="mb-2 text-xs font-medium text-gray-700">Basado en:</p>
            <ul className="divide-y divide-gray-100 text-sm">
              {meses.map((f) => (
                <li key={f.mes} className="flex justify-between py-1.5">
                  <span className="text-gray-500">{etiquetaMes(f.mes)}</span>
                  <span className="text-gray-900">{formatoMoneda(f.utilidad_neta)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
