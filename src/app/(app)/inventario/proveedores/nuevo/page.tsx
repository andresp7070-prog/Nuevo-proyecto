import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NuevoProveedorForm } from "./nuevo-proveedor-form";

export default async function NuevoProveedorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NuevoProveedorForm />;
}
