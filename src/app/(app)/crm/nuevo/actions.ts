"use server";

import { createClient } from "@/lib/supabase/server";

export async function crearCliente(input: {
  nombre: string;
  telefono: string;
  email: string;
  empresaCliente: string;
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

  const atributos = input.empresaCliente ? { empresa: input.empresaCliente } : {};

  const { data, error } = await supabase
    .from("crm_contactos")
    .insert({
      empresa_id: perfil.empresa_id,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email,
      atributos,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}
