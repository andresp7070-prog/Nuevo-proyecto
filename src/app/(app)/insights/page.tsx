import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { primeraMayuscula } from "@/lib/texto";

type FilaVentaDia = {
  dia: string;
  dia_semana: string;
  es_festivo: boolean;
  numero_ventas: number;
  total_vendido: number;
};

type FilaProducto = {
  item_id: string;
  nombre: string;
  ingresos: number;
  utilidad: number;
  margen_porcentaje: number;
};

type FilaMes = {
  mes: string;
  utilidad_neta: number;
};

type FilaPerfilCliente = {
  contacto_id: string;
  ultima_compra: string;
  dias_promedio_entre_compras: number | null;
};

type Contacto = {
  id: string;
  nombre: string;
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function etiquetaMes(mes: string) {
  return primeraMayuscula(
    new Date(mes).toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
  );
}

const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const UMBRAL_DESVIACION_DIA = 0.2; // 20%
const UMBRAL_MARGEN_BAJO = 15; // %

export default async function InsightsPage() {
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

  const [
    { data: ventasPorDiaData },
    { data: porProductoData },
    { data: porMesData },
    { data: perfilesClienteData },
    { data: contactosData },
  ] = await Promise.all([
    supabase
      .from("vista_ventas_por_dia")
      .select("dia, dia_semana, es_festivo, numero_ventas, total_vendido")
      .eq("empresa_id", perfil.empresa_id),
    supabase
      .from("vista_utilidad_por_producto")
      .select("item_id, nombre, ingresos, utilidad, margen_porcentaje")
      .eq("empresa_id", perfil.empresa_id)
      .order("utilidad", { ascending: false }),
    supabase
      .from("vista_estado_resultados")
      .select("mes, utilidad_neta")
      .eq("empresa_id", perfil.empresa_id)
      .order("mes", { ascending: false }),
    supabase
      .from("vista_perfil_cliente")
      .select("contacto_id, ultima_compra, dias_promedio_entre_compras")
      .eq("empresa_id", perfil.empresa_id),
    supabase.from("crm_contactos").select("id, nombre").eq("empresa_id", perfil.empresa_id),
  ]);

  const ventasPorDia = (ventasPorDiaData ?? []) as FilaVentaDia[];
  const porProducto = (porProductoData ?? []) as FilaProducto[];
  const porMes = (porMesData ?? []) as FilaMes[];
  const perfilesCliente = (perfilesClienteData ?? []) as FilaPerfilCliente[];
  const contactos = (contactosData ?? []) as Contacto[];
  const nombrePorContacto = new Map(contactos.map((c) => [c.id, c.nombre]));

  // ---- Agregados para el resumen general ----
  const porDiaSemana = ORDEN_DIAS.map((dia) => {
    const filas = ventasPorDia.filter((f) => f.dia_semana === dia);
    const totalVendido = filas.reduce((s, f) => s + f.total_vendido, 0);
    const promedio = filas.length > 0 ? totalVendido / filas.length : 0;
    return { dia, promedio, diasConVenta: filas.length };
  });

  const promedioGeneral =
    ventasPorDia.length > 0
      ? ventasPorDia.reduce((s, f) => s + f.total_vendido, 0) / ventasPorDia.length
      : 0;

  const festivos = ventasPorDia.filter((f) => f.es_festivo);
  const noFestivos = ventasPorDia.filter((f) => !f.es_festivo);
  const promedioFestivo =
    festivos.length > 0 ? festivos.reduce((s, f) => s + f.total_vendido, 0) / festivos.length : null;
  const promedioNoFestivo =
    noFestivos.length > 0
      ? noFestivos.reduce((s, f) => s + f.total_vendido, 0) / noFestivos.length
      : null;

  // ---- Insights: solo lo que cruza un umbral ----
  type Insight = { titulo: string; detalle: string };
  const insights: Insight[] = [];

  if (promedioGeneral > 0) {
    const diasConDatos = porDiaSemana.filter((d) => d.diasConVenta > 0);
    const mejorDia = diasConDatos.reduce(
      (mejor, d) => (d.promedio > (mejor?.promedio ?? -Infinity) ? d : mejor),
      null as (typeof diasConDatos)[number] | null,
    );
    const peorDia = diasConDatos.reduce(
      (peor, d) => (d.promedio < (peor?.promedio ?? Infinity) ? d : peor),
      null as (typeof diasConDatos)[number] | null,
    );

    if (mejorDia && mejorDia.promedio >= promedioGeneral * (1 + UMBRAL_DESVIACION_DIA)) {
      insights.push({
        titulo: `Vendes más los ${mejorDia.dia}`,
        detalle: `Promedias ${formatoMoneda(mejorDia.promedio)} ese día, contra ${formatoMoneda(promedioGeneral)} en un día cualquiera.`,
      });
    }
    if (peorDia && peorDia.promedio <= promedioGeneral * (1 - UMBRAL_DESVIACION_DIA)) {
      insights.push({
        titulo: `Vendes menos los ${peorDia.dia}`,
        detalle: `Promedias ${formatoMoneda(peorDia.promedio)} ese día, contra ${formatoMoneda(promedioGeneral)} en un día cualquiera.`,
      });
    }
  }

  if (promedioFestivo !== null && promedioNoFestivo !== null && promedioNoFestivo > 0) {
    const diferencia = (promedioFestivo - promedioNoFestivo) / promedioNoFestivo;
    if (Math.abs(diferencia) >= UMBRAL_DESVIACION_DIA) {
      insights.push({
        titulo: diferencia > 0 ? "Vendes más en festivos" : "Vendes menos en festivos",
        detalle: `Promedias ${formatoMoneda(promedioFestivo)} en festivos, contra ${formatoMoneda(promedioNoFestivo)} en un día normal.`,
      });
    }
  }

  const productosMargenBajo = porProducto
    .filter((p) => p.ingresos > 0 && p.margen_porcentaje < UMBRAL_MARGEN_BAJO)
    .sort((a, b) => a.margen_porcentaje - b.margen_porcentaje)
    .slice(0, 3);

  for (const p of productosMargenBajo) {
    insights.push({
      titulo: `Margen bajo en "${p.nombre}"`,
      detalle:
        p.margen_porcentaje < 0
          ? `Lo estás vendiendo con pérdida: ${p.margen_porcentaje}% de margen.`
          : `Solo ${p.margen_porcentaje}% de margen — revisa su costo o precio de venta.`,
    });
  }

  if (porMes.length >= 2) {
    const [ultimo, anterior] = porMes;
    if (ultimo.utilidad_neta < anterior.utilidad_neta) {
      insights.push({
        titulo: `La utilidad bajó en ${etiquetaMes(ultimo.mes)}`,
        detalle: `Utilidad neta de ${formatoMoneda(ultimo.utilidad_neta)}, contra ${formatoMoneda(anterior.utilidad_neta)} en ${etiquetaMes(anterior.mes)}.`,
      });
    }
  }

  const hoy = new Date();
  const clientesEnRiesgo = perfilesCliente
    .filter((p) => p.dias_promedio_entre_compras !== null)
    .map((p) => {
      const diasDesdeUltima = Math.floor(
        (hoy.getTime() - new Date(p.ultima_compra).getTime()) / (1000 * 60 * 60 * 24),
      );
      return { ...p, diasDesdeUltima };
    })
    .filter((p) => p.diasDesdeUltima > (p.dias_promedio_entre_compras ?? 0))
    .sort(
      (a, b) =>
        b.diasDesdeUltima / (b.dias_promedio_entre_compras ?? 1) -
        a.diasDesdeUltima / (a.dias_promedio_entre_compras ?? 1),
    )
    .slice(0, 5);

  for (const c of clientesEnRiesgo) {
    const nombre = nombrePorContacto.get(c.contacto_id) ?? "Cliente";
    insights.push({
      titulo: `${nombre} no ha vuelto a comprar`,
      detalle: `Compra en promedio cada ${Math.round(c.dias_promedio_entre_compras ?? 0)} días, y ya lleva ${c.diasDesdeUltima} sin comprar.`,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Insights</h1>
        <p className="mt-1 text-sm text-gray-500">
          Lo que vale la pena señalar de tus datos reales — solo aparece cuando algo se sale de
          lo normal.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Insights encontrados</h2>
        {insights.length === 0 ? (
          <p className="text-sm text-gray-400">
            Todavía no hay suficientes datos, o todo está dentro de lo normal — no hay nada que
            señalar por ahora.
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900">{insight.titulo}</p>
                <p className="text-xs text-gray-500">{insight.detalle}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Resumen general</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 text-xs font-medium text-gray-700">Ventas por día de la semana</h3>
            <ul className="divide-y divide-gray-100 text-sm">
              {porDiaSemana.map((d) => (
                <li key={d.dia} className="flex justify-between py-1.5">
                  <span className="text-gray-500">{d.dia}</span>
                  <span className="text-gray-900">
                    {d.diasConVenta > 0 ? formatoMoneda(d.promedio) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 text-xs font-medium text-gray-700">Festivos vs. días normales</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Promedio en festivos</dt>
                <dd className="text-gray-900">
                  {promedioFestivo !== null ? formatoMoneda(promedioFestivo) : "Sin datos"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Promedio en días normales</dt>
                <dd className="text-gray-900">
                  {promedioNoFestivo !== null ? formatoMoneda(promedioNoFestivo) : "Sin datos"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 text-xs font-medium text-gray-700">Margen por producto</h3>
          {porProducto.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="pb-2 font-medium">Producto</th>
                    <th className="pb-2 font-medium">Ingresos</th>
                    <th className="pb-2 font-medium">Utilidad</th>
                    <th className="pb-2 font-medium">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {porProducto.map((p) => (
                    <tr key={p.item_id}>
                      <td className="py-2 text-gray-900">
                        <Link href={`/inventario/${p.item_id}`} className="hover:underline">
                          {p.nombre}
                        </Link>
                      </td>
                      <td className="py-2 text-gray-700">{formatoMoneda(p.ingresos)}</td>
                      <td className="py-2 text-gray-700">{formatoMoneda(p.utilidad)}</td>
                      <td
                        className={`py-2 ${p.margen_porcentaje < UMBRAL_MARGEN_BAJO ? "text-red-600" : "text-gray-700"}`}
                      >
                        {p.margen_porcentaje}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 text-xs font-medium text-gray-700">Utilidad por mes</h3>
          {porMes.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay datos suficientes.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {porMes.map((f) => (
                <li key={f.mes} className="flex justify-between py-1.5">
                  <span className="text-gray-500">{etiquetaMes(f.mes)}</span>
                  <span className={f.utilidad_neta >= 0 ? "text-gray-900" : "text-red-600"}>
                    {formatoMoneda(f.utilidad_neta)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
