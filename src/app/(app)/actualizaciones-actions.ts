"use server";

import { createClient } from "@/lib/supabase/server";

export async function marcarActualizacionVista(
  actualizacionId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase
    .from("perfiles")
    .update({ ultima_actualizacion_vista_id: actualizacionId })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { error: null };
}
