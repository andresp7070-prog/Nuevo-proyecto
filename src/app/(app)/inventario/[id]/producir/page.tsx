import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { calcularMaxProducible } from "@/lib/inventario";
import { ProducirForm } from "./producir-form";

type RecetaFila = {
  cantidad_insumo: number;
  inventario_items: { nombre: string; unidad: string; cantidad: number } | null;
};

export default async function ProducirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: item } = await supabase
    .from("inventario_items")
    .select("id, nombre, unidad")
    .eq("id", id)
    .single();

  if (!item) notFound();

  const { data } = await supabase
    .from("inventario_receta")
    .select(
      "cantidad_insumo, inventario_items!inventario_receta_item_insumo_id_fkey ( nombre, unidad, cantidad )",
    )
    .eq("item_resultante_id", id);

  const receta = (data ?? []) as unknown as RecetaFila[];

  const maxProducible = calcularMaxProducible(
    receta.map((fila) => ({
      cantidadInsumo: fila.cantidad_insumo,
      stockInsumo: fila.inventario_items?.cantidad ?? 0,
    })),
  );

  return <ProducirForm item={item} receta={receta} maxProducible={maxProducible} />;
}
