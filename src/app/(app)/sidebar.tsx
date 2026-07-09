"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modulos = [
  { nombre: "Resumen", href: "/resumen", slug: null },
  { nombre: "Ventas", href: "/ventas", slug: "ventas" },
  { nombre: "CRM", href: "/crm", slug: "crm" },
  { nombre: "Inventario", href: "/inventario", slug: "inventario" },
  { nombre: "Estado P y G", href: "/pyg", slug: "pyg" },
  { nombre: "Insights", href: "/insights", slug: "insights" },
  { nombre: "Promociones", href: "/promociones", slug: "promociones" },
];

export function Sidebar({ modulosActivos }: { modulosActivos: string[] }) {
  const pathname = usePathname();

  const modulosVisibles = modulos.filter(
    (modulo) => modulo.slug === null || modulosActivos.includes(modulo.slug),
  );

  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 p-4">
      <ul className="space-y-1">
        {modulosVisibles.map((modulo) => {
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
      </ul>
    </nav>
  );
}
