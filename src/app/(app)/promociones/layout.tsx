import { requerirModulo } from "@/lib/empresa";

export default async function PromocionesLayout({ children }: { children: React.ReactNode }) {
  await requerirModulo("promociones");
  return children;
}
