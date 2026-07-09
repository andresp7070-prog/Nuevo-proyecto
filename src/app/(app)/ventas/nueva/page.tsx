import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NuevaVentaForm } from "./nueva-venta-form";

export default async function NuevaVentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { data: items } = await supabase
    .from("inventario_items")
    .select("id, nombre, categoria, precio_venta, marca:atributos->>marca")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const { data: empresa } = await supabase
    .from("empresas")
    .select("metodos_pago_disponibles")
    .eq("id", perfil.empresa_id)
    .single();

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: promocionesData } = await supabase
    .from("promociones")
    .select(
      "id, nombre, tipo_promocion, valor, aplica_a_categoria, item_regalo_id, promocion_items ( item_id )",
    )
    .eq("empresa_id", perfil.empresa_id)
    .eq("activo", true)
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy);

  const promociones = (promocionesData ?? []).map((p) => {
    const regalo = p.item_regalo_id ? (items ?? []).find((i) => i.id === p.item_regalo_id) : null;
    return {
      id: p.id,
      nombre: p.nombre,
      tipoPromocion: p.tipo_promocion as "descuento_porcentaje" | "descuento_fijo" | "2x1" | "lleve_x_gratis",
      valor: p.valor,
      aplicaACategoria: p.aplica_a_categoria,
      itemIds: (p.promocion_items ?? []).map((pi) => pi.item_id),
      itemRegaloId: p.item_regalo_id,
      regaloNombre: regalo?.nombre ?? null,
      regaloPrecio: regalo?.precio_venta ?? 0,
    };
  });

  return (
    <NuevaVentaForm
      items={items ?? []}
      metodosPago={empresa?.metodos_pago_disponibles ?? []}
      promociones={promociones}
    />
  );
}
