"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { etiquetaUnidad } from "@/lib/unidades";
import { InventarioTabs } from "./inventario-tabs";
import { DescargarCsv } from "@/components/descargar-csv";

type Item = {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  cantidad: number;
  costo: number | null;
  precio_venta: number | null;
  marca: string | null;
  disponible: number | null;
  diasRestantes: number | null;
  fotoUrl: string | null;
};

type Orden = "cantidad-asc" | "cantidad-desc" | "dias-asc" | "dias-desc";

const opcionesOrden: { value: Orden; label: string }[] = [
  { value: "cantidad-asc", label: "Cantidad: menor a mayor" },
  { value: "cantidad-desc", label: "Cantidad: mayor a menor" },
  { value: "dias-asc", label: "Se acaba antes" },
  { value: "dias-desc", label: "Se acaba después" },
];

function cantidadEfectiva(item: Item) {
  return item.disponible ?? item.cantidad;
}

function formatoMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

export function DirectorioInventario({
  items,
  creado,
}: {
  items: Item[];
  creado: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("cantidad-asc");

  const filtrados = items
    .filter((item) => {
      const q = sinTildes(busqueda.trim());
      if (!q) return true;
      return (
        sinTildes(item.nombre).includes(q) ||
        sinTildes(item.categoria ?? "").includes(q) ||
        sinTildes(item.marca ?? "").includes(q)
      );
    })
    .sort((a, b) => {
      if (orden === "cantidad-asc") return cantidadEfectiva(a) - cantidadEfectiva(b);
      if (orden === "cantidad-desc") return cantidadEfectiva(b) - cantidadEfectiva(a);
      // Sin ventas suficientes para proyectar (null) siempre va al final, sin importar la dirección
      if (orden === "dias-asc") {
        if (a.diasRestantes === null) return 1;
        if (b.diasRestantes === null) return -1;
        return a.diasRestantes - b.diasRestantes;
      }
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      return b.diasRestantes - a.diasRestantes;
    });

  const filasCsv = filtrados.map((item) => ({
    nombre: item.nombre,
    tipo_stock: item.disponible !== null ? "Receta" : "Normal",
    categoria: item.categoria ?? "",
    marca: item.marca ?? "",
    unidad: etiquetaUnidad(item.unidad),
    cantidad: cantidadEfectiva(item),
    dias_restantes: item.diasRestantes ?? "",
    costo: item.costo ?? "",
    precio_venta: item.precio_venta ?? "",
  }));

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Inventario</h1>
        <div className="flex gap-2">
          <DescargarCsv
            filas={filasCsv}
            columnas={[
              { clave: "nombre", titulo: "Nombre" },
              { clave: "tipo_stock", titulo: "Tipo de stock" },
              { clave: "categoria", titulo: "Categoría" },
              { clave: "marca", titulo: "Marca" },
              { clave: "unidad", titulo: "Unidad" },
              { clave: "cantidad", titulo: "Cantidad" },
              { clave: "dias_restantes", titulo: "Días restantes" },
              { clave: "costo", titulo: "Costo" },
              { clave: "precio_venta", titulo: "Precio de venta" },
            ]}
            nombreArchivo="inventario.csv"
          />
          <Link
            href="/inventario/nuevo"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Agregar producto
          </Link>
        </div>
      </div>

      {creado && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Producto creado correctamente.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, categoría o marca"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          {opcionesOrden.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-gray-400">No hay productos que coincidan.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/inventario/${item.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {item.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.fotoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg border border-dashed border-gray-200" />
                  )}
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      {item.nombre}
                      {item.disponible !== null && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          Receta
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {[item.categoria, item.marca].filter(Boolean).join(" · ") || "Sin categoría"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right text-sm">
                  <div>
                    <p className="text-xs text-gray-400">
                      {item.disponible !== null ? "Disponible" : "Cantidad"}
                    </p>
                    <p
                      className={`font-medium ${
                        item.disponible !== null && item.disponible <= 0
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {item.disponible !== null ? item.disponible : item.cantidad}{" "}
                      {etiquetaUnidad(item.unidad)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Se acaba en</p>
                    <p
                      className={`font-medium ${
                        item.diasRestantes !== null && item.diasRestantes <= 3
                          ? "text-red-600"
                          : item.diasRestantes !== null && item.diasRestantes <= 7
                            ? "text-amber-600"
                            : "text-gray-900"
                      }`}
                    >
                      {item.diasRestantes !== null ? `${item.diasRestantes} día(s)` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Costo</p>
                    <p className="font-medium text-gray-900">{formatoMoneda(item.costo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Precio de venta</p>
                    <p className="font-medium text-gray-900">{formatoMoneda(item.precio_venta)}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
