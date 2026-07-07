"use server";

import { createClient } from "@/lib/supabase/server";

export async function cambiarEtapa(
  contactoId: string,
  etapa: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_contactos")
    .update({ etapa_pipeline: etapa })
    .eq("id", contactoId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function agregarInteraccion(input: {
  contactoId: string;
  fecha: string;
  tipo: string;
  nota: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_interacciones").insert({
    contacto_id: input.contactoId,
    fecha: input.fecha,
    tipo: input.tipo,
    nota: input.nota,
  });

  if (error) return { error: error.message };
  return { error: null };
}
