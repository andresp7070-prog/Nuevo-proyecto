import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InventarioTabs } from "../inventario-tabs";
import { ImportarInventarioForm } from "./importar-form";

export default async function ImportarInventarioPage() {
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

  return (
    <div>
      <InventarioTabs />
      <ImportarInventarioForm />
    </div>
  );
}
