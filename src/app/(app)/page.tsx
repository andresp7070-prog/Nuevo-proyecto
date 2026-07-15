import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";

export default async function HomePage() {
  const perfil = await getPerfilActual();

  if (esRolDePlataforma(perfil?.rol)) {
    redirect("/admin");
  }

  if (perfil?.rol_empresa === "vendedor") {
    redirect("/ventas");
  }

  const paginaEntrada = perfil?.empresas?.pagina_entrada;
  redirect(paginaEntrada ? `/${paginaEntrada}` : "/resumen");
}
