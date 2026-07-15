import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
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

  return (
    <div className="flex min-h-screen">
      <Sidebar
        modulosActivos={perfil.empresas?.modulos_activos ?? []}
        rolEmpresa={perfil.rol_empresa}
        esAdmin={esRolDePlataforma(perfil.rol)}
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
