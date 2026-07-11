"use server";

import { createClient } from "@/lib/supabase/server";

export async function crearMovimiento(input: {
  tipo: "ingreso" | "gasto";
  categoria: string;
  monto: number;
  fecha: string;
  nota: string;
  recurrente: boolean;
  frecuencia: string;
}): Promise<{ error: string | null }> {
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

  const { error } = await supabase.from("finanzas_movimientos").insert({
    empresa_id: perfil.empresa_id,
    tipo: input.tipo,
    categoria: input.categoria || null,
    monto: input.monto,
    fecha: input.fecha,
    nota: input.nota || null,
    recurrente: input.recurrente,
    frecuencia: input.frecuencia || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}
