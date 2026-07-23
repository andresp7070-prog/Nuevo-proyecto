"use server";

import { createClient } from "@/lib/supabase/server";

export async function agregarAbono(input: {
  apartadoId: string;
  monto: number;
  fecha: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase.rpc("agregar_abono_apartado", {
    p_apartado_id: input.apartadoId,
    p_monto: input.monto,
    p_fecha: input.fecha,
  });

  if (error) return { error: error.message };
  return { error: null };
}
