"use server";

import { createClient } from "@/lib/supabase/server";
import { reemplazarReceta } from "@/lib/inventario";
import { errorTamanoFoto } from "@/lib/fotos";

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

export async function subirFotoProducto(
  formData: FormData,
): Promise<{ error: string | null; path?: string }> {
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

  const itemId = formData.get("itemId");
  const foto = formData.get("foto");

  if (typeof itemId !== "string" || !itemId) {
    return { error: "Falta el producto." };
  }
  if (!(foto instanceof File) || foto.size === 0) {
    return { error: "No se seleccionó ninguna foto." };
  }
  const errorValidacion = errorTamanoFoto(foto);
  if (errorValidacion) return { error: errorValidacion };

  const extension = foto.name.split(".").pop() ?? "jpg";
  const path = `${perfil.empresa_id}/${itemId}/${Date.now()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from("inventario-fotos")
    .upload(path, foto, { contentType: foto.type });

  if (errorSubida) return { error: errorSubida.message };

  const { error: errorUpdate } = await supabase
    .from("inventario_items")
    .update({ foto_path: path })
    .eq("id", itemId);

  if (errorUpdate) return { error: errorUpdate.message };

  return { error: null, path };
}

export async function ajustarInventario(input: {
  itemId: string;
  cantidadReal: number;
  nota: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase.rpc("ajustar_inventario", {
    p_item_id: input.itemId,
    p_cantidad_real: input.cantidadReal,
    p_nota: input.nota || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}
