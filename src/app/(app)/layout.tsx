import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { obtenerContextoPunto } from "@/lib/puntos";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/signout-button";
import { Sidebar } from "./sidebar";
import { PopupActualizacion } from "./popup-actualizacion";

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

  // Una cuenta limitada a un punto de venta (ej. Florida) no ve el menú
  // normal de la plataforma en absoluto — su única pantalla es el kiosko de
  // autopedido de ese punto. No hay forma de navegar a otro lado desde acá.
  if (perfil.punto_venta_id) {
    redirect(`/pedir/${perfil.punto_venta_id}`);
  }

  const esDePlataforma = esRolDePlataforma(perfil.rol);
  let puntosVenta: { id: string; nombre: string }[] = [];
  let puntoSeleccionado: string | null = null;
  let mostrarSelectorPunto = false;
  let actualizacionPendiente: { id: string; titulo: string; contenido: string } | null = null;

  if (!esDePlataforma) {
    const supabase = await createClient();

    if (perfil.empresa_id) {
      const contexto = await obtenerContextoPunto(supabase, perfil.empresa_id, perfil.punto_venta_id);
      puntosVenta = contexto.puntosVenta;
      puntoSeleccionado = contexto.puntoSeleccionado;
      mostrarSelectorPunto = contexto.mostrarSelector;
    }

    const { data: ultimaActualizacion } = await supabase
      .from("actualizaciones")
      .select("id, titulo, contenido")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaActualizacion && ultimaActualizacion.id !== perfil.ultima_actualizacion_vista_id) {
      actualizacionPendiente = ultimaActualizacion;
    }
  }

  return (
    <div className="flex min-h-screen">
      {actualizacionPendiente && <PopupActualizacion actualizacion={actualizacionPendiente} />}
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
        permiteApartados={perfil.empresas?.permite_apartados ?? false}
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
