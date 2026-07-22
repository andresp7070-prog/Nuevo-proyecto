"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mensajeErrorAuth } from "@/lib/auth-errores";

export async function cambiarPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const password = formData.get("password") as string;
  const confirmar = formData.get("confirmar") as string;

  if (!password || password.length < 6) {
    redirect(
      `/cambiar-password?error=${encodeURIComponent("La contraseña debe tener al menos 6 caracteres.")}`,
    );
  }
  if (password !== confirmar) {
    redirect(`/cambiar-password?error=${encodeURIComponent("Las contraseñas no coinciden.")}`);
  }

  const { error: errorAuth } = await supabase.auth.updateUser({ password });
  if (errorAuth) {
    redirect(`/cambiar-password?error=${encodeURIComponent(mensajeErrorAuth(errorAuth))}`);
  }

  const { error: errorPerfil } = await supabase
    .from("perfiles")
    .update({ debe_cambiar_password: false })
    .eq("id", user.id);
  if (errorPerfil) {
    redirect(`/cambiar-password?error=${encodeURIComponent(errorPerfil.message)}`);
  }

  redirect("/");
}
