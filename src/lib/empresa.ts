import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Empresa = {
  id: string;
  nombre: string;
  tipo_negocio: string | null;
  pagina_entrada: string;
  modulos_activos: string[];
};

type Perfil = {
  rol: string;
  rol_empresa: "administrador" | "vendedor";
  nombre: string | null;
  empresa_id: string | null;
  punto_venta_id: string | null;
  debe_cambiar_password: boolean;
  ultima_actualizacion_vista_id: string | null;
  empresas: Empresa | null;
};

export async function getPerfilActual(): Promise<Perfil | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select(
      "rol, rol_empresa, nombre, empresa_id, punto_venta_id, debe_cambiar_password, ultima_actualizacion_vista_id, empresas ( id, nombre, tipo_negocio, pagina_entrada, modulos_activos )",
    )
    .eq("id", user.id)
    .single();

  // La relación empresa_id -> empresas.id es uno-a-uno; Supabase la tipa como
  // arreglo por falta de tipos generados, pero en tiempo de ejecución es un objeto.
  return perfil as unknown as Perfil | null;
}

// Cualquier rol de plataforma (soporte o dueño) — distinto de un rol dentro
// de una empresa cliente. No confundir con requerirAdmin(): esto no protege
// el reporte global, solo decide navegación general (a dónde aterriza, qué
// ve el menú). El reporte global exige además el id exacto del usuario.
export function esRolDePlataforma(rol: string | undefined) {
  return rol === "admin" || rol === "super_admin";
}

// Bloquea el acceso directo por URL a un módulo que la empresa no tiene
// activo, o que el rol de la persona dentro de la empresa no le permite ver
// (aunque no aparezca en el menú, alguien podría intentar entrar escribiendo
// la dirección a mano). Un "vendedor" solo puede ver Ventas.
export async function requerirModulo(modulo: string) {
  const perfil = await getPerfilActual();
  if (esRolDePlataforma(perfil?.rol)) return;

  if (perfil?.rol_empresa === "vendedor" && modulo !== "ventas") {
    redirect("/ventas");
  }

  const modulosActivos = perfil?.empresas?.modulos_activos ?? [];
  if (!modulosActivos.includes(modulo)) {
    redirect("/resumen");
  }
}

// Bloquea el acceso al panel de administrador y sus pantallas (reporte
// global, enviar bienvenida) a exactamente una cuenta — la de Andrés,
// identificada por su id de usuario en SUPER_ADMIN_USER_ID. No basta con
// tener rol = 'admin': si en el futuro existe otra cuenta con ese rol, esta
// función igual la bloquea. Es intencional — este panel ve datos de todas
// las empresas cliente juntas, y debe quedar exclusivo de una sola persona.
export async function requerirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const superAdminId = process.env.SUPER_ADMIN_USER_ID;
  if (!user || !superAdminId || user.id !== superAdminId) {
    redirect("/resumen");
  }
}
