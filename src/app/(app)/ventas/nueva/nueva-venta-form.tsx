"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ahoraFecha, ahoraHora } from "@/lib/fecha";
import { sinTildes } from "@/lib/texto";
import { buscarClientes, guardarVenta, type ClienteEncontrado } from "./actions";

type ItemCatalogo = {
  id: string;
  nombre: string;
  precio_venta: number | null;
  marca: string | null;
};

const etiquetaMetodoPago: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  otro: "Otro",
};

type LineaVenta = {
  key: string;
  itemId: string;
  busquedaProducto: string;
  mostrarSugerenciasProducto: boolean;
  cantidad: number;
  precioUnitario: number;
};

function nuevaLinea(): LineaVenta {
  return {
    key: crypto.randomUUID(),
    itemId: "",
    busquedaProducto: "",
    mostrarSugerenciasProducto: false,
    cantidad: 1,
    precioUnitario: 0,
  };
}

function filtrarItems(items: ItemCatalogo[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return items
    .filter(
      (item) => sinTildes(item.nombre).includes(q) || sinTildes(item.marca ?? "").includes(q),
    )
    .slice(0, 8);
}

export function NuevaVentaForm({
  items,
  metodosPago,
}: {
  items: ItemCatalogo[];
  metodosPago: string[];
}) {
  const router = useRouter();

  const [orden, setOrden] = useState<"cliente-primero" | "productos-primero">("cliente-primero");
  const [metodoPago, setMetodoPago] = useState(metodosPago[0] ?? "");

  const [fecha, setFecha] = useState(ahoraFecha());
  const [hora, setHora] = useState(ahoraHora());

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [contactoId, setContactoId] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<ClienteEncontrado[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [busquedaClienteLista, setBusquedaClienteLista] = useState(false);

  const [lineas, setLineas] = useState<LineaVenta[]>([nuevaLinea()]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (contactoId || nombre.trim().length < 2) {
        setSugerencias([]);
        setBusquedaClienteLista(true);
        return;
      }
      const resultados = await buscarClientes(nombre);
      setSugerencias(resultados);
      setMostrarSugerencias(true);
      setBusquedaClienteLista(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [nombre, contactoId]);

  function seleccionarCliente(cliente: ClienteEncontrado) {
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono ?? "");
    setEmail(cliente.email ?? "");
    setContactoId(cliente.id);
    setMostrarSugerencias(false);
  }

  function actualizarNombre(valor: string) {
    setNombre(valor);
    setContactoId(null);
  }

  function agregarLinea() {
    setLineas((actual) => [...actual, nuevaLinea()]);
  }

  function quitarLinea(key: string) {
    setLineas((actual) => actual.filter((linea) => linea.key !== key));
  }

  function actualizarLinea(key: string, cambios: Partial<LineaVenta>) {
    setLineas((actual) =>
      actual.map((linea) => (linea.key === key ? { ...linea, ...cambios } : linea)),
    );
  }

  function buscarProducto(key: string, texto: string) {
    actualizarLinea(key, {
      busquedaProducto: texto,
      itemId: "",
      mostrarSugerenciasProducto: true,
    });
  }

  function seleccionarProducto(key: string, item: ItemCatalogo) {
    actualizarLinea(key, {
      itemId: item.id,
      busquedaProducto: item.marca ? `${item.nombre} — ${item.marca}` : item.nombre,
      precioUnitario: item.precio_venta ?? 0,
      mostrarSugerenciasProducto: false,
    });
  }

  const total = lineas.reduce((suma, linea) => suma + linea.cantidad * linea.precioUnitario, 0);

  async function guardar() {
    setError(null);

    const lineasValidas = lineas.filter((linea) => linea.itemId && linea.cantidad > 0);
    if (lineasValidas.length === 0) {
      setError("Agrega al menos un producto con cantidad mayor a cero.");
      return;
    }
    if (!nombre.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    if (!/^\d+$/.test(telefono.trim())) {
      setError("El teléfono es obligatorio y solo puede contener números.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError("El correo es obligatorio y debe ser válido.");
      return;
    }
    if (!metodoPago) {
      setError("Selecciona un método de pago.");
      return;
    }

    setGuardando(true);
    try {
      const fechaHora = new Date(`${fecha}T${hora}:00`).toISOString();
      const resultado = await guardarVenta({
        contactoId,
        clienteNombre: nombre.trim(),
        clienteTelefono: telefono.trim(),
        clienteEmail: email.trim(),
        fecha: fechaHora,
        metodoPago,
        items: lineasValidas.map((linea) => ({
          itemId: linea.itemId,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario,
        })),
      });
      if (resultado.error) {
        setError(resultado.error);
        setGuardando(false);
        return;
      }
      router.push("/ventas?guardada=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la venta.");
      setGuardando(false);
    }
  }

  const seccionCliente = (
    <section key="cliente" className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Cliente</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => actualizarNombre(e.target.value)}
            onFocus={() => setMostrarSugerencias(sugerencias.length > 0)}
            onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            placeholder="Nombre del cliente"
          />
          {mostrarSugerencias && sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-sm">
              {sugerencias.map((cliente) => (
                <li key={cliente.id}>
                  <button
                    type="button"
                    onMouseDown={() => seleccionarCliente(cliente)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {cliente.nombre}
                    {cliente.telefono && (
                      <span className="ml-2 text-gray-400">{cliente.telefono}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {contactoId && (
            <p className="mt-1 text-xs text-green-600">Cliente existente confirmado</p>
          )}
          {!contactoId && busquedaClienteLista && nombre.trim().length >= 2 && sugerencias.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Cliente nuevo — se registrará automáticamente.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono *</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
            type="tel"
            inputMode="numeric"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Correo *</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>
    </section>
  );

  const seccionProductos = (
    <section key="productos" className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Productos</h2>
      <div className="space-y-3">
        {lineas.map((linea) => (
          <div key={linea.key} className="grid grid-cols-12 items-end gap-2">
            <div className="relative col-span-6">
              <label className="mb-1 block text-xs font-medium text-gray-700">Producto *</label>
              <input
                value={linea.busquedaProducto}
                onChange={(e) => buscarProducto(linea.key, e.target.value)}
                onFocus={() =>
                  actualizarLinea(linea.key, { mostrarSugerenciasProducto: true })
                }
                onBlur={() =>
                  setTimeout(
                    () => actualizarLinea(linea.key, { mostrarSugerenciasProducto: false }),
                    150,
                  )
                }
                placeholder="Busca por nombre o marca"
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
              {linea.mostrarSugerenciasProducto &&
                filtrarItems(items, linea.busquedaProducto).length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-sm">
                    {filtrarItems(items, linea.busquedaProducto).map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseDown={() => seleccionarProducto(linea.key, item)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {item.nombre}
                          {item.marca && (
                            <span className="ml-2 text-gray-400">{item.marca}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad *</label>
              <input
                type="number"
                min={1}
                value={linea.cantidad}
                onChange={(e) =>
                  actualizarLinea(linea.key, { cantidad: Number(e.target.value) || 0 })
                }
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div className="col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Precio unitario
              </label>
              <input
                type="number"
                min={0}
                value={linea.precioUnitario}
                onChange={(e) =>
                  actualizarLinea(linea.key, { precioUnitario: Number(e.target.value) || 0 })
                }
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div className="col-span-1 flex justify-end">
              <button
                type="button"
                onClick={() => quitarLinea(linea.key)}
                className="text-sm text-red-500 hover:text-red-700"
                aria-label="Quitar producto"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={agregarLinea}
        className="mt-3 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        + Agregar producto
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Método de pago *
          </label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {metodosPago.length === 0 && <option value="">Sin métodos configurados</option>}
            {metodosPago.map((valor) => (
              <option key={valor} value={valor}>
                {etiquetaMetodoPago[valor] ?? valor}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm font-semibold text-gray-900">
          Total: {total.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
        </p>
      </div>
    </section>
  );

  const secciones =
    orden === "cliente-primero"
      ? [seccionCliente, seccionProductos]
      : [seccionProductos, seccionCliente];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar venta</h1>
        <button
          type="button"
          onClick={() =>
            setOrden((actual) =>
              actual === "cliente-primero" ? "productos-primero" : "cliente-primero",
            )
          }
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cambiar orden ↕
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Hora</label>
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-6">{secciones}</div>

      <p className="mt-3 text-xs text-gray-400">* Campos obligatorios</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar venta"}
      </button>
    </div>
  );
}
