"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modulos = [
  { nombre: "Resumen", href: "/resumen" },
  { nombre: "Ventas", href: "/ventas" },
  { nombre: "CRM", href: "/crm" },
  { nombre: "Inventario", href: "/inventario" },
  { nombre: "Estado P y G", href: "/pyg" },
  { nombre: "Insights", href: "/insights" },
  { nombre: "Promociones", href: "/promociones" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 p-4">
      <ul className="space-y-1">
        {modulos.map((modulo) => {
          const activo = pathname === modulo.href || pathname.startsWith(`${modulo.href}/`);
          return (
            <li key={modulo.href}>
              <Link
                href={modulo.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  activo ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {modulo.nombre}
              </Link>
            </li>
          );
        })}
        <li>
          <span className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-400">
            Facturación
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">Próximamente</span>
          </span>
        </li>
      </ul>
    </nav>
  );
}
