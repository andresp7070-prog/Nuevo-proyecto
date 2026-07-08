import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type Promocion = {
  id: string;
  nombre: string;
  codigo: string | null;
  tipo_promocion: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
};

const etiquetaTipo: Record<string, string> = {
  descuento_porcentaje: "Descuento %",
  descuento_fijo: "Descuento fijo",
  "2x1": "2x1",
  lleve_x_gratis: "Lleve X gratis",
};

function estadoPromocion(p: Promocion) {
  if (!p.activo) return { etiqueta: "Desactivada", clase: "text-gray-400" };
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy < p.fecha_inicio) return { etiqueta: "Programada", clase: "text-amber-600" };
  if (hoy > p.fecha_fin) return { etiqueta: "Finalizada", clase: "text-gray-400" };
  return { etiqueta: "Activa ahora", clase: "text-green-700" };
}

export default async function PromocionesPage() {
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
    .from("promociones")
    .select("id, nombre, codigo, tipo_promocion, fecha_inicio, fecha_fin, activo")
    .eq("empresa_id", perfil.empresa_id)
    .order("fecha_inicio", { ascending: false });

  const promociones = (data ?? []) as Promocion[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Promociones</h1>
        <Link
          href="/promociones/nueva"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Agregar promoción
        </Link>
      </div>

      {promociones.length === 0 ? (
        <p className="text-gray-400">Todavía no tienes promociones registradas.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {promociones.map((p) => {
            const estado = estadoPromocion(p);
            return (
              <li key={p.id}>
                <Link
                  href={`/promociones/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {[etiquetaTipo[p.tipo_promocion] ?? p.tipo_promocion, p.codigo]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · {p.fecha_inicio} a {p.fecha_fin}
                    </p>
                  </div>
                  <span className={`text-sm font-medium ${estado.clase}`}>{estado.etiqueta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
