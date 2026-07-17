import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { obtenerContextoPunto } from "@/lib/puntos";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/signout-button";
import { Sidebar } from "./sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  if (!perfil) {
    redirect("/login");
  }

  if (perfil.debe_cambiar_password) {
    redirect("/cambiar-password");
  }

  const esDePlataforma = esRolDePlataforma(perfil.rol);
  let puntosVenta: { id: string; nombre: string }[] = [];
  let puntoSeleccionado: string | null = null;
  let mostrarSelectorPunto = false;

  if (!esDePlataforma && perfil.empresa_id) {
    const supabase = await createClient();
    const contexto = await obtenerContextoPunto(supabase, perfil.empresa_id, perfil.punto_venta_id);
    puntosVenta = contexto.puntosVenta;
    puntoSeleccionado = contexto.puntoSeleccionado;
    mostrarSelectorPunto = contexto.mostrarSelector;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        modulosActivos={perfil.empresas?.modulos_activos ?? []}
        rolEmpresa={perfil.rol_empresa}
        esAdmin={esDePlataforma}
        puntosVenta={puntosVenta}
        puntoSeleccionado={puntoSeleccionado}
        mostrarSelectorPunto={mostrarSelectorPunto}
        puntoFijoNombre={
          !mostrarSelectorPunto && perfil.punto_venta_id
            ? (puntosVenta.find((p) => p.id === perfil.punto_venta_id)?.nombre ?? null)
            : null
        }
      />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <span className="text-sm text-gray-500">{perfil.nombre}</span>
          <SignOutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
