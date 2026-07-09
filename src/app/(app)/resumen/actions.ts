"use server";

import { createClient } from "@/lib/supabase/server";
import { errorTamanoFoto, TAMANO_MAXIMO_LOGO_BYTES } from "@/lib/fotos";

export async function subirLogoEmpresa(
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

  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size === 0) {
    return { error: "No se seleccionó ningún archivo." };
  }
  const errorValidacion = errorTamanoFoto(logo, TAMANO_MAXIMO_LOGO_BYTES);
  if (errorValidacion) return { error: errorValidacion };

  const extension = logo.name.split(".").pop() ?? "png";
  const path = `${perfil.empresa_id}/logo.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from("empresas-logos")
    .upload(path, logo, { contentType: logo.type, upsert: true });

  if (errorSubida) return { error: errorSubida.message };

  const { error: errorUpdate } = await supabase
    .from("empresas")
    .update({ logo_path: path })
    .eq("id", perfil.empresa_id);

  if (errorUpdate) return { error: errorUpdate.message };

  return { error: null, path };
}
