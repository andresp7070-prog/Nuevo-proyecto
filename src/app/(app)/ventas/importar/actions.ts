"use server";

import { createClient } from "@/lib/supabase/server";

export type FilaVentaHistorica = {
  fecha: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number | null;
  metodoPago: string;
};

export async function importarVentasHistoricas(
  filas: FilaVentaHistorica[],
  descontarInventario: boolean,
): Promise<{ error: string | null; importadas: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa.", importadas: null };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada.", importadas: null };
  }

  const { data, error } = await supabase.rpc("importar_ventas_historicas", {
    p_empresa_id: perfil.empresa_id,
    p_ventas: filas.map((f) => ({
      fecha: f.fecha,
      cliente_nombre: f.clienteNombre,
      cliente_telefono: f.clienteTelefono,
      cliente_email: f.clienteEmail,
      producto: f.producto,
      cantidad: f.cantidad,
      precio_unitario: f.precioUnitario,
      costo_unitario: f.costoUnitario,
      metodo_pago: f.metodoPago,
    })),
    p_descontar_inventario: descontarInventario,
  });

  if (error) return { error: error.message, importadas: null };
  return { error: null, importadas: data as number };
}
