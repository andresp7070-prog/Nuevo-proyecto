"use server";

import { createClient } from "@/lib/supabase/server";

export type ClienteEncontrado = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
};

export async function buscarClientes(query: string): Promise<ClienteEncontrado[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) return [];

  const { data, error } = await supabase.rpc("buscar_clientes", {
    p_empresa_id: perfil.empresa_id,
    p_query: query,
  });

  if (error) return [];
  return data ?? [];
}

export type ItemVentaInput = {
  itemId: string | null;
  nombreLibre: string | null;
  costoUnitario: number | null;
  cantidad: number;
  precioUnitario: number;
  promocionId: string | null;
  descuentoAplicado: number;
};

export async function guardarVenta(input: {
  contactoId: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  fecha: string;
  metodoPago: string;
  items: ItemVentaInput[];
  puntoVentaId?: string | null;
}): Promise<{ error: string | null; ventaId?: string }> {
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

  const { data: ventaId, error } = await supabase.rpc("registrar_venta", {
    p_empresa_id: perfil.empresa_id,
    p_contacto_id: input.contactoId,
    p_cliente_nombre: input.clienteNombre,
    p_cliente_telefono: input.clienteTelefono,
    p_cliente_email: input.clienteEmail || null,
    p_atributos_cliente: {},
    p_atributos_venta: {},
    p_items: input.items.map((item) => ({
      item_id: item.itemId,
      nombre_libre: item.nombreLibre,
      costo_unitario: item.costoUnitario,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      promocion_id: item.promocionId,
      descuento_aplicado: item.descuentoAplicado,
    })),
    p_fecha: input.fecha,
    p_metodo_pago: input.metodoPago,
    p_punto_venta_id: input.puntoVentaId ?? null,
  });

  if (error) return { error: error.message };
  return { error: null, ventaId: ventaId as string };
}

export type ItemApartadoInput = {
  itemId: string;
  cantidad: number;
  precioUnitario: number;
};

export async function registrarApartado(input: {
  contactoId: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  montoInicial: number;
  items: ItemApartadoInput[];
  puntoVentaId?: string | null;
}): Promise<{ error: string | null; apartadoId?: string }> {
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

  const { data: apartadoId, error } = await supabase.rpc("registrar_apartado", {
    p_empresa_id: perfil.empresa_id,
    p_contacto_id: input.contactoId,
    p_cliente_nombre: input.clienteNombre,
    p_cliente_telefono: input.clienteTelefono,
    p_cliente_email: input.clienteEmail || null,
    p_items: input.items.map((item) => ({
      item_id: item.itemId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
    })),
    p_monto_inicial: input.montoInicial,
    p_punto_venta_id: input.puntoVentaId ?? null,
  });

  if (error) return { error: error.message };
  return { error: null, apartadoId: apartadoId as string };
}

export async function deshacerVenta(ventaId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase.rpc("deshacer_venta", { p_venta_id: ventaId });

  if (error) return { error: error.message };
  return { error: null };
}
