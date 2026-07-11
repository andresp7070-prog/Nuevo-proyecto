"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/inventario", etiqueta: "Productos" },
  { href: "/inventario/recetas", etiqueta: "Recetas" },
  { href: "/inventario/proveedores", etiqueta: "Proveedores" },
  { href: "/inventario/proyecciones", etiqueta: "Proyecciones" },
  { href: "/inventario/importar", etiqueta: "Importar" },
];

export function InventarioTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-4 border-b border-gray-200">
      {PESTANAS.map((pestana) => {
        const activa =
          pestana.href === "/inventario"
            ? pathname === "/inventario"
            : pathname.startsWith(pestana.href);
        return (
          <Link
            key={pestana.href}
            href={pestana.href}
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              activa
                ? "border-accent text-accent"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {pestana.etiqueta}
          </Link>
        );
      })}
    </div>
  );
}
