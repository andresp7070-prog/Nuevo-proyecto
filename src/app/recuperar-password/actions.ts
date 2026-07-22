"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://datum.vercel.app";

export async function solicitarRecuperacion(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  // No se revisa el resultado a propósito: la pantalla siempre muestra el
  // mismo mensaje exista o no una cuenta con ese correo, para que este
  // formulario no sirva para averiguar qué correos están registrados.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${URL_APP}/auth/confirm?next=/restablecer-password`,
  });

  redirect("/recuperar-password?enviado=1");
}
