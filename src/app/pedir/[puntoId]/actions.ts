"use server";

import { createClient } from "@/lib/supabase/server";

type ItemPedido = { itemId: string; cantidad: number; precioUnitario: number };

export async function registrarPedidoKiosko(
  puntoId: string,
  items: ItemPedido[],
): Promise<{ error: string | null; ventaId?: string; codigo?: string }> {
  if (items.length === 0) return { error: "El pedido está vacío." };

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

  if (!perfil?.empresa_id) return { error: "Tu usuario no tiene una empresa asignada." };

  // Verifica que el punto sea de esta empresa, igual que en la página —
  // una Server Action se puede invocar directo, no solo desde el formulario.
  const { data: punto } = await supabase
    .from("puntos_venta")
    .select("empresa_id")
    .eq("id", puntoId)
    .single();

  if (!punto || punto.empresa_id !== perfil.empresa_id) {
    return { error: "Ese punto de venta no existe o no es de tu empresa." };
  }

  const { data: ventaId, error } = await supabase.rpc("registrar_venta", {
    p_empresa_id: perfil.empresa_id,
    p_contacto_id: null,
    p_cliente_nombre: null,
    p_cliente_telefono: null,
    p_cliente_email: null,
    p_atributos_cliente: {},
    p_atributos_venta: { origen: "kiosko" },
    p_items: items.map((item) => ({
      item_id: item.itemId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
    })),
    p_fecha: null,
    p_metodo_pago: null,
    p_punto_venta_id: puntoId,
  });

  if (error) return { error: error.message };

  // Código corto para que el cliente lo diga en el mostrador al recoger y pagar.
  const codigo = ventaId ? ventaId.slice(0, 4).toUpperCase() : "----";

  return { error: null, ventaId: ventaId ?? undefined, codigo };
}
