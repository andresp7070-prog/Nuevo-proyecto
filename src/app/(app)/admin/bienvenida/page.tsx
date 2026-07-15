import { requerirAdmin } from "@/lib/empresa";
import { BienvenidaForm } from "./bienvenida-form";

export default async function BienvenidaPage() {
  await requerirAdmin();
  return <BienvenidaForm />;
}
