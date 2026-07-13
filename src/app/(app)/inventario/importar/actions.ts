"use server";

import { createClient } from "@/lib/supabase/server";

export type FilaImportacion = {
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  costo: number;
  precioVenta: number;
  esInsumo: boolean;
};

export async function cargarInventarioInicial(
  filas: FilaImportacion[],
): Promise<{ error: string | null; creados: number | null; actualizados: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa.", creados: null, actualizados: null };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada.", creados: null, actualizados: null };
  }

  const { data, error } = await supabase.rpc("cargar_inventario_inicial", {
    p_empresa_id: perfil.empresa_id,
    p_items: filas.map((f) => ({
      nombre: f.nombre,
      categoria: f.categoria,
      unidad: f.unidad,
      cantidad: f.cantidad,
      costo: f.costo,
      precio_venta: f.precioVenta,
      es_insumo: f.esInsumo,
    })),
  });

  if (error) return { error: error.message, creados: null, actualizados: null };

  const creados = data as number;
  return { error: null, creados, actualizados: filas.length - creados };
}
