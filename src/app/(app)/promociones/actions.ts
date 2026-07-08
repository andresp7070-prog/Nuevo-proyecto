"use server";

import { createClient } from "@/lib/supabase/server";

export async function crearPromocion(input: {
  nombre: string;
  codigo: string;
  tipoPromocion: "descuento_porcentaje" | "descuento_fijo" | "2x1" | "lleve_x_gratis";
  valor: number | null;
  aplicaAItemId: string | null;
  aplicaACategoria: string | null;
  itemRegaloId: string | null;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
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
    .from("promociones")
    .insert({
      empresa_id: perfil.empresa_id,
      nombre: input.nombre,
      codigo: input.codigo || null,
      tipo_promocion: input.tipoPromocion,
      valor: input.valor,
      aplica_a_item_id: input.aplicaAItemId,
      aplica_a_categoria: input.aplicaACategoria,
      item_regalo_id: input.itemRegaloId,
      fecha_inicio: input.fechaInicio,
      fecha_fin: input.fechaFin,
      activo: input.activo,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}
