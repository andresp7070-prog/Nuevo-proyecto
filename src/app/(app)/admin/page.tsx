import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";

const NOMBRE_MODULO: Record<string, string> = {
  ventas: "Ventas",
  crm: "CRM",
  inventario: "Inventario",
  pyg: "Estado P y G",
  insights: "Insights",
  promociones: "Promociones",
};

const NOMBRE_TIPO_NEGOCIO: Record<string, string> = {
  aseo: "Aseo",
  ropa: "Ropa",
  restaurante: "Restaurante",
  cafeteria: "Cafetería",
  belleza: "Belleza",
  ferreteria: "Ferretería",
  taller: "Taller",
  tienda: "Tienda",
  papeleria: "Papelería",
  otro: "Otro",
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

// Límite del plan actual de Supabase (Free = 500 MB). Si subes a Pro, el
// límite pasa a 8 GB — actualiza este número si cambias de plan.
const LIMITE_BD_BYTES = 500 * 1024 * 1024;

function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let valor = bytes;
  let i = -1;
  do {
    valor /= 1024;
    i++;
  } while (valor >= 1024 && i < unidades.length - 1);
  return `${valor.toFixed(1)} ${unidades[i]}`;
}

// Medianoche del primer día del mes, en hora Colombia (UTC-5) convertida a UTC.
function primerDiaMesColombiaISO(): string {
  const hoyColombia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return `${hoyColombia.slice(0, 7)}-01T05:00:00.000Z`;
}

// Medianoche del 1 de enero del año actual, en hora Colombia (UTC-5) convertida a UTC.
function primerDiaAnioColombiaISO(): string {
  const hoyColombia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return `${hoyColombia.slice(0, 4)}-01-01T05:00:00.000Z`;
}

export default async function AdminDashboardPage() {
  await requerirAdmin();
  const supabase = await createClient();

  const inicioMesIso = primerDiaMesColombiaISO();
  const inicioAnioIso = primerDiaAnioColombiaISO();
  const hace30DiasIso = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: empresas },
    { data: ventasMes },
    { data: ventasAnio },
    { data: ventasRecientes },
    { data: tamanoBd },
  ] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, nombre, tipo_negocio, modulos_activos, monto_mensual, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("ventas").select("monto").gte("fecha", inicioMesIso),
    supabase.from("ventas").select("monto").gte("fecha", inicioAnioIso),
    supabase.from("ventas").select("empresa_id").gte("fecha", hace30DiasIso),
    supabase.rpc("tamano_base_datos"),
  ]);

  const listaEmpresas = empresas ?? [];
  const totalEmpresas = listaEmpresas.length;
  const totalVentasMes = (ventasMes ?? []).reduce((suma, v) => suma + Number(v.monto), 0);
  const totalVentasAnio = (ventasAnio ?? []).reduce((suma, v) => suma + Number(v.monto), 0);
  const empresasActivas = new Set((ventasRecientes ?? []).map((v) => v.empresa_id)).size;
  const ingresosMensuales = listaEmpresas.reduce(
    (suma, e) => suma + Number(e.monto_mensual ?? 0),
    0,
  );

  const conteoModulos: Record<string, number> = {};
  for (const empresa of listaEmpresas) {
    for (const modulo of empresa.modulos_activos ?? []) {
      conteoModulos[modulo] = (conteoModulos[modulo] ?? 0) + 1;
    }
  }
  const modulosOrdenados = Object.entries(conteoModulos).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Panel de administrador</h1>
        <Link
          href="/admin/bienvenida"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          Enviar bienvenida
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Empresas cliente</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totalEmpresas}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Clientes activos (30 días)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{empresasActivas}</p>
          <p className="mt-1 text-xs text-gray-400">Con al menos una venta registrada</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Ventas del mes (todas las empresas)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{formatoMoneda(totalVentasMes)}</p>
          <p className="mt-1 text-xs text-gray-400">
            {formatoMoneda(totalVentasAnio)} en total este año
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Ingresos por suscripción (nuestros, al mes)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatoMoneda(ingresosMensuales)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Cargado a mano por empresa</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Uso de la plataforma</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Base de datos (Supabase)</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {tamanoBd !== null && tamanoBd !== undefined ? formatoBytes(Number(tamanoBd)) : "—"}
              <span className="text-sm font-normal text-gray-400">
                {" "}
                de {formatoBytes(LIMITE_BD_BYTES)}
              </span>
            </p>
            {tamanoBd !== null && tamanoBd !== undefined && (
              <div className="mt-2 h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{
                    width: `${Math.min(100, (Number(tamanoBd) / LIMITE_BD_BYTES) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">Ancho de banda (Vercel)</p>
            <p className="mt-1 text-lg font-semibold text-gray-300">Pendiente</p>
            <p className="mt-1 text-xs text-gray-400">Requiere plan Pro de Vercel</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Almacenamiento de archivos (Supabase)</p>
            <p className="mt-1 text-lg font-semibold text-gray-300">Pendiente</p>
            <p className="mt-1 text-xs text-gray-400">Falta conectar la API de Supabase</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Módulos activados</h2>
        {modulosOrdenados.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay empresas con módulos activos.</p>
        ) : (
          <ul className="space-y-2">
            {modulosOrdenados.map(([modulo, cantidad]) => (
              <li key={modulo} className="flex items-center gap-3 text-sm">
                <span className="w-32 text-gray-700">{NOMBRE_MODULO[modulo] ?? modulo}</span>
                <div className="h-2 flex-1 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${(cantidad / totalEmpresas) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right text-gray-500">
                  {cantidad}/{totalEmpresas}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Empresas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400">
              <tr>
                <th className="px-2 py-2">Nombre</th>
                <th className="px-2 py-2">Tipo de negocio</th>
                <th className="px-2 py-2">Módulos</th>
                <th className="px-2 py-2">Mensualidad</th>
                <th className="px-2 py-2">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listaEmpresas.map((empresa) => (
                <tr key={empresa.id}>
                  <td className="px-2 py-2 text-gray-900">{empresa.nombre}</td>
                  <td className="px-2 py-2 text-gray-500">
                    {empresa.tipo_negocio ? NOMBRE_TIPO_NEGOCIO[empresa.tipo_negocio] ?? empresa.tipo_negocio : "—"}
                  </td>
                  <td className="px-2 py-2 text-gray-500">
                    {(empresa.modulos_activos ?? [])
                      .map((m: string) => NOMBRE_MODULO[m] ?? m)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-2 py-2 text-gray-500">
                    {empresa.monto_mensual ? formatoMoneda(Number(empresa.monto_mensual)) : "—"}
                  </td>
                  <td className="px-2 py-2 text-gray-500">
                    {new Date(empresa.created_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
