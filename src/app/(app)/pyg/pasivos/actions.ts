"use server";

import { createClient } from "@/lib/supabase/server";

export async function crearPasivo(input: {
  descripcion: string;
  tipo: string;
  montoTotal: number;
  fechaVencimiento: string;
}): Promise<{ error: string | null }> {
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

  const { error } = await supabase.from("pasivos").insert({
    empresa_id: perfil.empresa_id,
    descripcion: input.descripcion,
    tipo: input.tipo || null,
    monto_total: input.montoTotal,
    fecha_vencimiento: input.fechaVencimiento || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function registrarAbono(input: {
  pasivoId: string;
  monto: number;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: pasivo, error: errorLectura } = await supabase
    .from("pasivos")
    .select("monto_total, monto_pagado")
    .eq("id", input.pasivoId)
    .single();

  if (errorLectura || !pasivo) {
    return { error: errorLectura?.message ?? "No se encontró la deuda." };
  }

  const nuevoPagado = Math.min(pasivo.monto_pagado + input.monto, pasivo.monto_total);
  const nuevoEstado = nuevoPagado >= pasivo.monto_total ? "pagado" : "pendiente";

  const { error } = await supabase
    .from("pasivos")
    .update({ monto_pagado: nuevoPagado, estado: nuevoEstado })
    .eq("id", input.pasivoId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function marcarPagado(pasivoId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: pasivo, error: errorLectura } = await supabase
    .from("pasivos")
    .select("monto_total")
    .eq("id", pasivoId)
    .single();

  if (errorLectura || !pasivo) {
    return { error: errorLectura?.message ?? "No se encontró la deuda." };
  }

  const { error } = await supabase
    .from("pasivos")
    .update({ monto_pagado: pasivo.monto_total, estado: "pagado" })
    .eq("id", pasivoId);

  if (error) return { error: error.message };
  return { error: null };
}
