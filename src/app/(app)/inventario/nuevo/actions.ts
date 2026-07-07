"use server";

import { createClient } from "@/lib/supabase/server";
import { reemplazarReceta } from "@/lib/inventario";

type LineaReceta = { insumoId: string; cantidad: number };

export async function crearProducto(input: {
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  costo: number;
  precioVenta: number;
  receta: LineaReceta[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    throw new Error("Tu usuario no tiene una empresa asignada.");
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
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await reemplazarReceta(supabase, data.id as string, input.receta);
}

export async function reabastecerProducto(input: {
  itemId: string;
  categoria: string;
  cantidadAgregada: number;
  costo: number;
  precioVenta: number;
  receta: LineaReceta[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { error } = await supabase.rpc("reabastecer_producto", {
    p_item_id: input.itemId,
    p_cantidad_agregada: input.cantidadAgregada,
    p_costo: input.costo,
    p_precio_venta: input.precioVenta,
    p_categoria: input.categoria || null,
  });

  if (error) throw new Error(error.message);

  await reemplazarReceta(supabase, input.itemId, input.receta);
}
