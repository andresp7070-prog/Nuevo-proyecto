"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { ahoraFecha } from "@/lib/fecha";
import { CampoMoneda } from "@/components/campo-moneda";
import { crearPromocion } from "../actions";

type Item = {
  id: string;
  nombre: string;
  categoria: string | null;
};

type TipoPromocion = "descuento_porcentaje" | "descuento_fijo" | "2x1" | "lleve_x_gratis";

const TIPOS: { value: TipoPromocion; label: string }[] = [
  { value: "descuento_porcentaje", label: "Descuento %" },
  { value: "descuento_fijo", label: "Descuento fijo" },
  { value: "2x1", label: "2x1" },
  { value: "lleve_x_gratis", label: "Lleve X gratis" },
];

function filtrarItems(items: Item[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return items.filter((i) => sinTildes(i.nombre).includes(q)).slice(0, 8);
}

function filtrarCategorias(categorias: string[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return categorias.filter((c) => sinTildes(c).includes(q)).slice(0, 8);
}

export function NuevaPromocionForm({ items }: { items: Item[] }) {
  const router = useRouter();

  const categoriasExistentes = Array.from(
    new Set(items.map((i) => i.categoria).filter((c): c is string => Boolean(c))),
  );

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipoPromocion, setTipoPromocion] = useState<TipoPromocion>("descuento_porcentaje");
  const [valorPorcentaje, setValorPorcentaje] = useState("");
  const [valorFijo, setValorFijo] = useState("");

  const [aplicaA, setAplicaA] = useState<"todo" | "producto" | "categoria">("todo");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productosSeleccionados, setProductosSeleccionados] = useState<Item[]>([]);
  const [mostrarSugerenciasProducto, setMostrarSugerenciasProducto] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [mostrarSugerenciasCategoria, setMostrarSugerenciasCategoria] = useState(false);

  const [busquedaRegalo, setBusquedaRegalo] = useState("");
  const [regaloSeleccionado, setRegaloSeleccionado] = useState<Item | null>(null);
  const [mostrarSugerenciasRegalo, setMostrarSugerenciasRegalo] = useState(false);

  const [fechaInicio, setFechaInicio] = useState(ahoraFecha());
  const [fechaFin, setFechaFin] = useState("");
  const [activo, setActivo] = useState(true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sugerenciasProducto = filtrarItems(items, busquedaProducto).filter(
    (item) => !productosSeleccionados.some((p) => p.id === item.id),
  );
  const sugerenciasCategoria = filtrarCategorias(categoriasExistentes, categoriaSeleccionada);
  const sugerenciasRegalo = filtrarItems(items, busquedaRegalo);

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    let valor: number | null = null;
    if (tipoPromocion === "descuento_porcentaje") {
      const n = Number(valorPorcentaje);
      if (valorPorcentaje.trim() === "" || Number.isNaN(n) || n <= 0 || n > 100) {
        setError("El porcentaje de descuento debe ser un número entre 1 y 100.");
        return;
      }
      valor = n;
    } else if (tipoPromocion === "descuento_fijo") {
      const n = Number(valorFijo);
      if (valorFijo.trim() === "" || Number.isNaN(n) || n <= 0) {
        setError("El descuento fijo debe ser un monto mayor a cero.");
        return;
      }
      valor = n;
    }

    if (aplicaA === "producto" && productosSeleccionados.length === 0) {
      setError("Busca y elige al menos un producto al que aplica la promoción.");
      return;
    }
    if (aplicaA === "categoria" && !categoriaSeleccionada.trim()) {
      setError("Escribe la categoría a la que aplica la promoción.");
      return;
    }
    if (tipoPromocion === "lleve_x_gratis" && !regaloSeleccionado) {
      setError("Busca y elige el producto que se regala.");
      return;
    }
    if (!fechaInicio || !fechaFin) {
      setError("La fecha de inicio y de fin son obligatorias.");
      return;
    }
    if (fechaFin < fechaInicio) {
      setError("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearPromocion({
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        tipoPromocion,
        valor,
        aplicaAItemIds: aplicaA === "producto" ? productosSeleccionados.map((p) => p.id) : [],
        aplicaACategoria: aplicaA === "categoria" ? categoriaSeleccionada.trim() : null,
        itemRegaloId: tipoPromocion === "lleve_x_gratis" ? regaloSeleccionado!.id : null,
        fechaInicio,
        fechaFin,
        activo,
      });
      if (resultado.error || !resultado.id) {
        setError(resultado.error ?? "No se pudo guardar la promoción.");
        return;
      }
      router.push(`/promociones/${resultado.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la promoción.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar promoción</h1>
        <Link href="/promociones" className="text-sm text-gray-500 hover:text-gray-700">
          Ver promociones
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Cambio de aceite 20% - Julio"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Código (opcional)</label>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de campaña *</label>
          <select
            value={tipoPromocion}
            onChange={(e) => setTipoPromocion(e.target.value as typeof tipoPromocion)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {tipoPromocion === "descuento_porcentaje" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Porcentaje de descuento *
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={valorPorcentaje}
              onChange={(e) => setValorPorcentaje(e.target.value)}
              placeholder="Ej. 20"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        )}

        {tipoPromocion === "descuento_fijo" && (
          <CampoMoneda
            id="valorFijo"
            label="Monto del descuento"
            required
            value={valorFijo}
            onChange={setValorFijo}
          />
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Aplica a *</label>
          <div className="flex gap-2">
            {(["todo", "producto", "categoria"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setAplicaA(opcion)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs ${
                  aplicaA === opcion
                    ? "border-accent bg-accent text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {opcion === "todo" ? "Todo el catálogo" : opcion === "producto" ? "Uno o varios productos" : "Una categoría"}
              </button>
            ))}
          </div>
        </div>

        {aplicaA === "producto" && (
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">Productos *</label>
            <input
              value={busquedaProducto}
              onChange={(e) => {
                setBusquedaProducto(e.target.value);
                setMostrarSugerenciasProducto(true);
              }}
              onFocus={() => setMostrarSugerenciasProducto(sugerenciasProducto.length > 0)}
              onBlur={() => setTimeout(() => setMostrarSugerenciasProducto(false), 150)}
              placeholder="Busca un producto y elige los que quieras"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
            {mostrarSugerenciasProducto && sugerenciasProducto.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
                {sugerenciasProducto.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setProductosSeleccionados((actuales) => [...actuales, item]);
                        setBusquedaProducto("");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {item.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {productosSeleccionados.length > 0 && (
              <ul className="mt-2 space-y-1">
                {productosSeleccionados.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700"
                  >
                    {item.nombre}
                    <button
                      type="button"
                      onClick={() =>
                        setProductosSeleccionados((actuales) => actuales.filter((p) => p.id !== item.id))
                      }
                      className="text-gray-400 hover:text-gray-700"
                      aria-label={`Quitar ${item.nombre}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aplicaA === "categoria" && (
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">Categoría *</label>
            <input
              value={categoriaSeleccionada}
              onChange={(e) => {
                setCategoriaSeleccionada(e.target.value);
                setMostrarSugerenciasCategoria(true);
              }}
              onFocus={() => setMostrarSugerenciasCategoria(sugerenciasCategoria.length > 0)}
              onBlur={() => setTimeout(() => setMostrarSugerenciasCategoria(false), 150)}
              placeholder="Ej. Jabones"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
            {mostrarSugerenciasCategoria && sugerenciasCategoria.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
                {sugerenciasCategoria.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setCategoriaSeleccionada(c);
                        setMostrarSugerenciasCategoria(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tipoPromocion === "lleve_x_gratis" && (
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Producto que se regala *
            </label>
            <input
              value={busquedaRegalo}
              onChange={(e) => {
                setBusquedaRegalo(e.target.value);
                setRegaloSeleccionado(null);
                setMostrarSugerenciasRegalo(true);
              }}
              onFocus={() => setMostrarSugerenciasRegalo(sugerenciasRegalo.length > 0)}
              onBlur={() => setTimeout(() => setMostrarSugerenciasRegalo(false), 150)}
              placeholder="Busca un producto"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
            {mostrarSugerenciasRegalo && sugerenciasRegalo.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
                {sugerenciasRegalo.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setRegaloSeleccionado(item);
                        setBusquedaRegalo(item.nombre);
                        setMostrarSugerenciasRegalo(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {item.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {regaloSeleccionado && (
              <p className="mt-1 text-xs text-green-600">Se regala: {regaloSeleccionado.nombre}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha inicio *</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha fin *</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activa
        </label>

        <p className="text-xs text-gray-400">* Campos obligatorios</p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar promoción"}
      </button>
    </div>
  );
}
