"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearProducto } from "./actions";

export function NuevoProductoForm() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const cantidadNum = Number(cantidad);
    const costoNum = Number(costo);
    const precioVentaNum = Number(precioVenta);

    if (cantidad.trim() === "" || Number.isNaN(cantidadNum) || cantidadNum < 0) {
      setError("La cantidad es obligatoria y debe ser un número mayor o igual a cero.");
      return;
    }
    if (costo.trim() === "" || Number.isNaN(costoNum) || costoNum < 0) {
      setError("El costo es obligatorio y debe ser un número mayor o igual a cero.");
      return;
    }
    if (precioVenta.trim() === "" || Number.isNaN(precioVentaNum) || precioVentaNum < 0) {
      setError("El precio de venta es obligatorio y debe ser un número mayor o igual a cero.");
      return;
    }

    setGuardando(true);
    try {
      await crearProducto({
        nombre: nombre.trim(),
        categoria: categoria.trim(),
        cantidad: cantidadNum,
        costo: costoNum,
        precioVenta: precioVentaNum,
      });
      router.push("/inventario?creado=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el producto.");
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Agregar producto</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Categoría (opcional)
          </label>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ej. Jabones, Detergentes"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cantidad *</label>
          <input
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Costo (precio de compra) *
          </label>
          <input
            type="number"
            min={0}
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Precio de venta *
          </label>
          <input
            type="number"
            min={0}
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">* Campos obligatorios</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar producto"}
      </button>
    </div>
  );
}
