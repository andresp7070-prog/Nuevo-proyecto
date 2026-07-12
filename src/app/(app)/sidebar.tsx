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

function IconoCandado() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 7V4.8a3 3 0 0 1 6 0V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LogoCompass({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`${className} shrink-0`} aria-hidden="true">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3" />
      <path d="M24 12 L30 24 L24 36 L18 24 Z" fill="currentColor" />
    </svg>
  );
}

export function Sidebar({ modulosActivos }: { modulosActivos: string[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-gray-200 p-4">
      <div>
        <div className="mb-4 flex items-center gap-2 px-3 text-accent">
          <LogoCompass className="h-6 w-6" />
          <span className="font-serif text-lg font-semibold text-gray-900">Datum</span>
        </div>
        <ul className="space-y-1">
          {modulos.map((modulo) => {
            const habilitado = modulo.slug === null || modulosActivos.includes(modulo.slug);

            if (!habilitado) {
              return (
                <li key={modulo.href}>
                  <span
                    title="No incluido en tu plan actual"
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-400"
                  >
                    {modulo.nombre}
                    <IconoCandado />
                  </span>
                </li>
              );
            }

            const activo = pathname === modulo.href || pathname.startsWith(`${modulo.href}/`);
            return (
              <li key={modulo.href}>
                <Link
                  href={modulo.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                    activo ? "bg-accent text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {modulo.nombre}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-2 px-3 text-xs text-gray-400">
        <LogoCompass className="h-4 w-4" />
        <span>Desarrollado por Datum</span>
      </div>
    </nav>
  );
}
