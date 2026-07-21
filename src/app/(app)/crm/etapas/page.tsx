import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { EtapasForm } from "./etapas-form";

export default async function EtapasCrmPage() {
  await requerirModulo("crm");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, empresas ( crm_modo )")
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
  const empresa = perfil.empresas as unknown as { crm_modo: string } | null;
  if (empresa?.crm_modo !== "leads") redirect("/crm");

  const { data: etapas } = await supabase
    .from("crm_etapas")
    .select("id, nombre, orden, es_cierre, dias_inactividad, etapa_destino_inactividad_id")
    .eq("empresa_id", perfil.empresa_id)
    .order("orden");

  return <EtapasForm etapas={etapas ?? []} />;
}
