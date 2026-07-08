import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectorioPasivos } from "./directorio-pasivos";

export default async function PasivosPage() {
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

  const { data: pasivos } = await supabase
    .from("pasivos")
    .select("id, descripcion, tipo, monto_total, monto_pagado, fecha_vencimiento, estado")
    .eq("empresa_id", perfil.empresa_id)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  return <DirectorioPasivos pasivos={pasivos ?? []} />;
}
