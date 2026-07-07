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
  itemId: string;
  cantidad: number;
  precioUnitario: number;
};

export async function guardarVenta(input: {
  contactoId: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  fecha: string;
  metodoPago: string;
  items: ItemVentaInput[];
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
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
    })),
    p_fecha: input.fecha,
    p_metodo_pago: input.metodoPago,
  });

  if (error) return { error: error.message };
  return { error: null, ventaId: ventaId as string };
}
