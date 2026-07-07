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

export async function registrarProduccion(input: {
  itemResultanteId: string;
  cantidad: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { error } = await supabase.rpc("registrar_produccion", {
    p_item_resultante_id: input.itemResultanteId,
    p_cantidad_producida: input.cantidad,
  });

  if (error) throw new Error(error.message);
}
