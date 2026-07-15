import { requerirModulo } from "@/lib/empresa";

export default async function InventarioLayout({ children }: { children: React.ReactNode }) {
  await requerirModulo("inventario");
  return children;
}
