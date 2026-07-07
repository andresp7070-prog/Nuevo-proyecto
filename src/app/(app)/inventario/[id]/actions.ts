"use server";

import { createClient } from "@/lib/supabase/server";
import { reemplazarReceta } from "@/lib/inventario";

export async function guardarReceta(input: {
  itemResultanteId: string;
  lineas: { insumoId: string; cantidad: number }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  await reemplazarReceta(supabase, input.itemResultanteId, input.lineas);
}
