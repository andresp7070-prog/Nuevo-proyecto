import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { primeraMayuscula } from "@/lib/texto";
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
    .select("mes, ingresos_por_ventas")
    .eq("empresa_id", perfil.empresa_id)
    .order("mes", { ascending: false })
    .limit(3);

  const meses = (data ?? []) as FilaMes[];
  const promedio =
    meses.length > 0
      ? meses.reduce((suma, f) => suma + f.ingresos_por_ventas, 0) / meses.length
      : 0;

  return (
    <div>
      <VentasTabs />

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
