import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { DirectorioClientes } from "./directorio-clientes";

export default async function CrmPage() {
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
  const esCrmDeLeads = empresa?.crm_modo === "leads";

  // Las reglas de inactividad y "Configurar etapas" son exclusivas del CRM
  // de leads — una empresa de venta directa (crm_modo = 'ventas') se queda
  // exactamente como siempre, sin esta capa extra.
  if (esCrmDeLeads) {
    await supabase.rpc("aplicar_reglas_inactividad_crm", { p_empresa_id: perfil.empresa_id });
  }

  const { data: etapas } = await supabase
    .from("crm_etapas")
    .select("id, nombre, orden")
    .eq("empresa_id", perfil.empresa_id)
    .order("orden");

  const { data: contactos } = await supabase
    .from("crm_contactos")
    .select("id, nombre, telefono, email, etapa_id, empresa_cliente:atributos->>empresa")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  return (
    <DirectorioClientes
      contactos={contactos ?? []}
      etapas={etapas ?? []}
      mostrarConfigEtapas={esCrmDeLeads}
    />
  );
}
