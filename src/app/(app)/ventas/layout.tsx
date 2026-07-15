import { requerirModulo } from "@/lib/empresa";

export default async function VentasLayout({ children }: { children: React.ReactNode }) {
  await requerirModulo("ventas");
  return children;
}
