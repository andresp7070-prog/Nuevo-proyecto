import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectorioClientes } from "./directorio-clientes";

export default async function CrmPage() {
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

  const { data: contactos } = await supabase
    .from("crm_contactos")
    .select("id, nombre, telefono, email, etapa_pipeline, empresa_cliente:atributos->>empresa")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  return <DirectorioClientes contactos={contactos ?? []} />;
}
