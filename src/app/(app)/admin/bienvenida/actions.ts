"use server";

import { createClient } from "@/lib/supabase/server";
import { enviarCorreoBienvenida } from "@/lib/email";

export async function enviarBienvenida(input: {
  correo: string;
  nombreEmpresa: string;
  contrasena: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "admin") {
    return { error: "Solo un administrador puede enviar este correo." };
  }

  if (!input.correo.trim() || !input.nombreEmpresa.trim() || !input.contrasena.trim()) {
    return { error: "Completa correo, empresa y contraseña." };
  }

  return enviarCorreoBienvenida({
    correo: input.correo.trim(),
    nombreEmpresa: input.nombreEmpresa.trim(),
    contrasena: input.contrasena.trim(),
  });
}
