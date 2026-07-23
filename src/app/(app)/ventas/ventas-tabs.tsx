"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/ventas", etiqueta: "Historial" },
  { href: "/ventas/proyecciones", etiqueta: "Proyecciones" },
  { href: "/ventas/importar", etiqueta: "Importar" },
];

// "Apartados" es desarrollo a la medida de un solo cliente (Manantial) —
// nunca aparece salvo que la empresa tenga empresas.permite_apartados.
const PESTANA_APARTADOS = { href: "/ventas/apartados", etiqueta: "Apartados" };

export function VentasTabs({ permiteApartados = false }: { permiteApartados?: boolean }) {
  const pathname = usePathname();
  const pestanas = permiteApartados ? [...PESTANAS, PESTANA_APARTADOS] : PESTANAS;

  return (
    <div className="mb-6 flex gap-4 border-b border-gray-200">
      {pestanas.map((pestana) => {
        const activa =
          pestana.href === "/ventas" ? pathname === "/ventas" : pathname.startsWith(pestana.href);
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
