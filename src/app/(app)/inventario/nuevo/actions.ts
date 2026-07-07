"use server";

import { createClient } from "@/lib/supabase/server";

export async function crearProducto(input: {
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  costo: number;
  precioVenta: number;
  atributos?: Record<string, unknown>;
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
    .from("inventario_items")
    .insert({
      empresa_id: perfil.empresa_id,
      nombre: input.nombre,
      categoria: input.categoria || null,
      unidad: input.unidad,
      cantidad: input.cantidad,
      costo: input.costo,
      precio_venta: input.precioVenta,
      atributos: input.atributos ?? {},
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  return { error: null, id: data.id as string };
}

export async function reabastecerProducto(input: {
  itemId: string;
  categoria: string;
  cantidadAgregada: number;
  costo: number;
  precioVenta: number;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase.rpc("reabastecer_producto", {
    p_item_id: input.itemId,
    p_cantidad_agregada: input.cantidadAgregada,
    p_costo: input.costo,
    p_precio_venta: input.precioVenta,
    p_categoria: input.categoria || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}
