import { requerirModulo } from "@/lib/empresa";

export default async function PygLayout({ children }: { children: React.ReactNode }) {
  await requerirModulo("pyg");
  return children;
}
