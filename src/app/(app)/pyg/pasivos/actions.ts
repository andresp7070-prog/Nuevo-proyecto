"use server";

import { createClient } from "@/lib/supabase/server";

export async function crearPasivo(input: {
  descripcion: string;
  tipo: string;
  montoTotal: number;
  fechaVencimiento: string;
  frecuenciaPago: string;
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
    frecuencia_pago: input.frecuenciaPago || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function registrarAbono(input: {
  pasivoId: string;
  monto: number;
  fecha: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: pasivo, error: errorLectura } = await supabase
    .from("pasivos")
    .select("empresa_id, descripcion, monto_total, monto_pagado")
    .eq("id", input.pasivoId)
    .single();

  if (errorLectura || !pasivo) {
    return { error: errorLectura?.message ?? "No se encontró la deuda." };
  }

  const saldoRestante = pasivo.monto_total - pasivo.monto_pagado;
  const montoAplicado = Math.min(input.monto, saldoRestante);
  const nuevoPagado = pasivo.monto_pagado + montoAplicado;
  const nuevoEstado = nuevoPagado >= pasivo.monto_total ? "pagado" : "pendiente";

  const { error } = await supabase
    .from("pasivos")
    .update({ monto_pagado: nuevoPagado, estado: nuevoEstado })
    .eq("id", input.pasivoId);

  if (error) return { error: error.message };

  const { error: errorGasto } = await supabase.from("finanzas_movimientos").insert({
    empresa_id: pasivo.empresa_id,
    tipo: "gasto",
    categoria: "pago de deuda",
    monto: montoAplicado,
    fecha: input.fecha,
    nota: `Abono a "${pasivo.descripcion}"`,
    pasivo_id: input.pasivoId,
  });

  if (errorGasto) return { error: errorGasto.message };
  return { error: null };
}

export async function marcarPagado(input: {
  pasivoId: string;
  fecha: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: pasivo, error: errorLectura } = await supabase
    .from("pasivos")
    .select("empresa_id, descripcion, monto_total, monto_pagado")
    .eq("id", input.pasivoId)
    .single();

  if (errorLectura || !pasivo) {
    return { error: errorLectura?.message ?? "No se encontró la deuda." };
  }

  const saldoRestante = pasivo.monto_total - pasivo.monto_pagado;

  const { error } = await supabase
    .from("pasivos")
    .update({ monto_pagado: pasivo.monto_total, estado: "pagado" })
    .eq("id", input.pasivoId);

  if (error) return { error: error.message };

  if (saldoRestante > 0) {
    const { error: errorGasto } = await supabase.from("finanzas_movimientos").insert({
      empresa_id: pasivo.empresa_id,
      tipo: "gasto",
      categoria: "pago de deuda",
      monto: saldoRestante,
      fecha: input.fecha,
      nota: `Pago final de "${pasivo.descripcion}"`,
      pasivo_id: input.pasivoId,
    });

    if (errorGasto) return { error: errorGasto.message };
  }

  return { error: null };
}
