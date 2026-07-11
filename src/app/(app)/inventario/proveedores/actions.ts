"use server";

import { createClient } from "@/lib/supabase/server";

export async function crearProveedor(input: {
  nombre: string;
  telefono: string;
  frecuenciaPago: string;
  diaSemanaPago: string | null;
  diasPersonalizado: number | null;
}): Promise<{ error: string | null; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada." };
  }

  const { data, error } = await supabase
    .from("proveedores")
    .insert({
      empresa_id: perfil.empresa_id,
      nombre: input.nombre,
      telefono: input.telefono || null,
      frecuencia_pago: input.frecuenciaPago,
      dia_semana_pago: input.diaSemanaPago,
      dias_personalizado: input.diasPersonalizado,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}
