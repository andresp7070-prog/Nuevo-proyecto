"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mensajeErrorAuth } from "@/lib/auth-errores";

export async function restablecerPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const password = formData.get("password") as string;
  const confirmar = formData.get("confirmar") as string;

  if (!password || password.length < 6) {
    redirect(
      `/restablecer-password?error=${encodeURIComponent("La contraseña debe tener al menos 6 caracteres.")}`,
    );
  }
  if (password !== confirmar) {
    redirect(`/restablecer-password?error=${encodeURIComponent("Las contraseñas no coinciden.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/restablecer-password?error=${encodeURIComponent(mensajeErrorAuth(error))}`);
  }

  redirect("/");
}
