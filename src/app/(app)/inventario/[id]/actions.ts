"use server";

import { createClient } from "@/lib/supabase/server";
import { reemplazarReceta } from "@/lib/inventario";

export async function guardarReceta(input: {
  itemResultanteId: string;
  lineas: { insumoId: string; cantidad: number }[];
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  try {
    await reemplazarReceta(supabase, input.itemResultanteId, input.lineas);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo guardar la receta." };
  }
}
