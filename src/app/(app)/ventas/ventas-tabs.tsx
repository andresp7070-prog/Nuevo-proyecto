"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/ventas", etiqueta: "Historial" },
  { href: "/ventas/proyecciones", etiqueta: "Proyecciones" },
];

export function VentasTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-4 border-b border-gray-200">
      {PESTANAS.map((pestana) => {
        const activa =
          pestana.href === "/ventas" ? pathname === "/ventas" : pathname.startsWith(pestana.href);
        return (
          <Link
            key={pestana.href}
            href={pestana.href}
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              activa
                ? "border-gray-900 text-gray-900"
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
