import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ApartadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, empresas ( permite_apartados )")
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
  if (!empresa?.permite_apartados) redirect("/ventas");

  // Cierra los apartados vencidos (más de 30 días sin completar el pago)
  // antes de traer la lista — no hay proceso en segundo plano, se revisa
  // cada vez que alguien abre esta pantalla.
  await supabase.rpc("aplicar_vencimiento_apartados", { p_empresa_id: perfil.empresa_id });

  const { data: apartados } = await supabase
    .from("apartados")
    .select("id, cliente_nombre, monto_total, monto_abonado, fecha, fecha_limite, estado")
    .eq("empresa_id", perfil.empresa_id)
    .order("estado", { ascending: true })
    .order("fecha_limite", { ascending: true });

  const hoy = new Date().toISOString().slice(0, 10);

  function diasRestantes(fechaLimite: string) {
    const diff = Math.ceil(
      (new Date(fechaLimite).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  }

  function formatoMoneda(valor: number) {
    return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
  }

  const etiquetaEstado: Record<string, string> = {
    activo: "Activo",
    reclamado: "Reclamado",
    vencido: "Vencido",
  };

  const colorEstado: Record<string, string> = {
    activo: "bg-amber-50 text-amber-700",
    reclamado: "bg-green-50 text-green-700",
    vencido: "bg-gray-100 text-gray-500",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Apartados</h1>
        <Link
          href="/ventas/nueva"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Nuevo apartado
        </Link>
      </div>

      {!apartados || apartados.length === 0 ? (
        <p className="text-gray-400">Todavía no hay apartados registrados.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {apartados.map((apartado) => {
            const dias = diasRestantes(apartado.fecha_limite);
            return (
              <li key={apartado.id}>
                <Link
                  href={`/apartados/${apartado.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {apartado.cliente_nombre ?? "Cliente sin nombre"}
                    </p>
                    <p className="text-xs text-gray-400">
                      Apartado el {new Date(apartado.fecha).toLocaleDateString("es-CO")}
                      {apartado.estado === "activo" &&
                        (dias >= 0
                          ? ` — vence en ${dias} día(s)`
                          : ` — venció hace ${Math.abs(dias)} día(s)`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Abonado / Total</p>
                      <p className="font-medium text-gray-900">
                        {formatoMoneda(apartado.monto_abonado)} / {formatoMoneda(apartado.monto_total)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${colorEstado[apartado.estado]}`}
                    >
                      {etiquetaEstado[apartado.estado] ?? apartado.estado}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
