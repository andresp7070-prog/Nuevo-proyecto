"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ahoraFecha, ahoraHora } from "@/lib/fecha";
import { sinTildes } from "@/lib/texto";
import { etiquetaUnidad } from "@/lib/unidades";
import { EntradaMoneda } from "@/components/campo-moneda";
import { buscarClientes, guardarVenta, deshacerVenta, type ClienteEncontrado } from "./actions";

const SEGUNDOS_PARA_DESHACER = 60;

type ItemCatalogo = {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  cantidad: number;
  precio_venta: number | null;
  marca: string | null;
  sku: string | null;
  diasRestantes: number | null;
};

function etiquetaProducto(item: ItemCatalogo) {
  return item.sku ? `${item.sku} - ${item.nombre}` : item.nombre;
}

type Promocion = {
  id: string;
  nombre: string;
  tipoPromocion: "descuento_porcentaje" | "descuento_fijo" | "2x1" | "lleve_x_gratis";
  valor: number | null;
  aplicaACategoria: string | null;
  itemIds: string[];
  itemRegaloId: string | null;
  regaloNombre: string | null;
  regaloPrecio: number;
};

const etiquetaTipoPromocion: Record<Promocion["tipoPromocion"], string> = {
  descuento_porcentaje: "Descuento %",
  descuento_fijo: "Descuento fijo",
  "2x1": "2x1",
  lleve_x_gratis: "Lleve X gratis",
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
  nombreLibre: string;
  costoUnitario: number | "";
  cantidad: number | "";
  precioUnitario: number;
  precioOriginal: number;
  promocionId: string | null;
  esGratis: boolean;
};

function nuevaLinea(): LineaVenta {
  return {
    key: crypto.randomUUID(),
    itemId: "",
    busquedaProducto: "",
    mostrarSugerenciasProducto: false,
    nombreLibre: "",
    costoUnitario: "",
    cantidad: "",
    precioUnitario: 0,
    precioOriginal: 0,
    promocionId: null,
    esGratis: false,
  };
}

// Solo números enteros — sin puntos, comas ni signos, aunque el campo permita
// escribirlos momentáneamente (ej. al intentar un decimal).
function cantidadDesdeInput(valorCrudo: string): number | "" {
  const soloDigitos = valorCrudo.replace(/[^\d]/g, "");
  if (soloDigitos === "") return "";
  return Number(soloDigitos);
}

// 2x1: de cada 2 unidades que ya están en la línea, 1 es gratis — se calcula
// solo a partir de la cantidad escrita, sin agregar unidades manuales aparte.
function desglose2x1(cantidad: number): { pagadas: number; gratis: number } {
  const gratis = Math.floor(cantidad / 2);
  return { pagadas: cantidad - gratis, gratis };
}

function filtrarItems(items: ItemCatalogo[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return items
    .filter(
      (item) =>
        sinTildes(item.nombre).includes(q) ||
        sinTildes(item.marca ?? "").includes(q) ||
        sinTildes(item.sku ?? "").includes(q),
    )
    .slice(0, 8);
}

function filtrarSugerencias(sugerencias: string[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return sugerencias.filter((s) => sinTildes(s).includes(q)).slice(0, 8);
}

export function NuevaVentaForm({
  items,
  sugerenciasProductos,
  inventarioActivo,
  metodosPago,
  promociones,
  crmActivo,
}: {
  items: ItemCatalogo[];
  sugerenciasProductos: string[];
  inventarioActivo: boolean;
  metodosPago: string[];
  promociones: Promocion[];
  crmActivo: boolean;
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

  const [ultimaVenta, setUltimaVenta] = useState<{ id: string; venceEn: number } | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [deshaciendo, setDeshaciendo] = useState(false);

  useEffect(() => {
    if (!ultimaVenta) return;
    const actualizar = () => {
      const restante = Math.max(0, Math.ceil((ultimaVenta.venceEn - Date.now()) / 1000));
      setSegundosRestantes(restante);
      if (restante <= 0) setUltimaVenta(null);
    };
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [ultimaVenta]);

  async function deshacer() {
    if (!ultimaVenta) return;
    setError(null);
    setDeshaciendo(true);
    try {
      const resultado = await deshacerVenta(ultimaVenta.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setUltimaVenta(null);
      router.refresh();
    } finally {
      setDeshaciendo(false);
    }
  }

  useEffect(() => {
    if (!crmActivo) return;
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
  }, [nombre, contactoId, crmActivo]);

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
    const base = etiquetaProducto(item);
    actualizarLinea(key, {
      itemId: item.id,
      busquedaProducto: item.marca ? `${base} — ${item.marca}` : base,
      precioUnitario: item.precio_venta ?? 0,
      precioOriginal: item.precio_venta ?? 0,
      promocionId: null,
      mostrarSugerenciasProducto: false,
    });
  }

  function escribirNombreLibre(key: string, texto: string) {
    actualizarLinea(key, { nombreLibre: texto, mostrarSugerenciasProducto: true });
  }

  function seleccionarNombreLibre(key: string, nombre: string) {
    actualizarLinea(key, { nombreLibre: nombre, mostrarSugerenciasProducto: false });
  }

  function promocionesAplicables(itemId: string): Promocion[] {
    const item = items.find((i) => i.id === itemId);
    if (!item) return [];
    return promociones.filter((promo) => {
      if (promo.itemIds.length > 0) return promo.itemIds.includes(item.id);
      if (promo.aplicaACategoria) return promo.aplicaACategoria === item.categoria;
      return true;
    });
  }

  function aplicarPromocion(linea: LineaVenta, promo: Promocion | null) {
    if (!promo) {
      actualizarLinea(linea.key, { promocionId: null, precioUnitario: linea.precioOriginal });
      return;
    }
    if (promo.tipoPromocion === "descuento_porcentaje") {
      const nuevoPrecio = Math.round(linea.precioOriginal * (1 - (promo.valor ?? 0) / 100));
      actualizarLinea(linea.key, { promocionId: promo.id, precioUnitario: Math.max(0, nuevoPrecio) });
    } else if (promo.tipoPromocion === "descuento_fijo") {
      const nuevoPrecio = linea.precioOriginal - (promo.valor ?? 0);
      actualizarLinea(linea.key, { promocionId: promo.id, precioUnitario: Math.max(0, nuevoPrecio) });
    } else {
      actualizarLinea(linea.key, { promocionId: promo.id, precioUnitario: linea.precioOriginal });
    }
  }

  function agregarRegalo(promo: Promocion) {
    if (!promo.itemRegaloId) return;
    setLineas((actual) => [
      ...actual,
      {
        key: crypto.randomUUID(),
        itemId: promo.itemRegaloId!,
        busquedaProducto: promo.regaloNombre ?? "Regalo",
        mostrarSugerenciasProducto: false,
        nombreLibre: "",
        costoUnitario: "",
        cantidad: 1,
        precioUnitario: 0,
        precioOriginal: promo.regaloPrecio,
        promocionId: promo.id,
        esGratis: true,
      },
    ]);
  }

  const total = lineas.reduce((suma, linea) => {
    const cantidadNum = linea.cantidad === "" ? 0 : linea.cantidad;
    if (!linea.esGratis) {
      const promo = promociones.find((p) => p.id === linea.promocionId) ?? null;
      if (promo?.tipoPromocion === "2x1") {
        return suma + desglose2x1(cantidadNum).pagadas * linea.precioUnitario;
      }
    }
    return suma + cantidadNum * linea.precioUnitario;
  }, 0);

  async function guardar() {
    setError(null);
    setUltimaVenta(null);

    const lineasValidas = lineas.filter(
      (linea): linea is LineaVenta & { cantidad: number } =>
        Boolean(inventarioActivo ? linea.itemId : linea.nombreLibre.trim()) &&
        linea.cantidad !== "" &&
        linea.cantidad > 0,
    );
    if (lineasValidas.length === 0) {
      setError(
        inventarioActivo
          ? "Agrega al menos un producto con cantidad mayor a cero."
          : "Escribe al menos qué vendiste, con cantidad mayor a cero.",
      );
      return;
    }

    // No se puede vender más de lo que hay — suma todas las líneas del mismo
    // producto (ej. la línea pagada + la gratis de un 2x1) contra el stock real.
    // Solo aplica cuando hay catálogo con stock real que controlar.
    const cantidadPorItem: Record<string, number> = {};
    for (const linea of lineasValidas) {
      if (!linea.itemId) continue;
      cantidadPorItem[linea.itemId] = (cantidadPorItem[linea.itemId] ?? 0) + linea.cantidad;
    }
    for (const [itemId, cantidadPedida] of Object.entries(cantidadPorItem)) {
      const item = items.find((i) => i.id === itemId);
      if (item && cantidadPedida > item.cantidad) {
        setError(
          `No hay suficiente stock de "${item.nombre}": quedan ${item.cantidad}, intentas vender ${cantidadPedida}. Agrega inventario antes de vender.`,
        );
        return;
      }
    }

    if (crmActivo) {
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
        items: lineasValidas.flatMap((linea) => {
          if (linea.esGratis) {
            return [
              {
                itemId: linea.itemId,
                nombreLibre: null,
                costoUnitario: null,
                cantidad: linea.cantidad,
                precioUnitario: linea.precioUnitario,
                promocionId: linea.promocionId,
                descuentoAplicado: linea.precioOriginal * linea.cantidad,
              },
            ];
          }

          const promo = promociones.find((p) => p.id === linea.promocionId) ?? null;

          // 2x1: la línea que la persona llenó se reparte sola en lo pagado y lo
          // gratis (de cada 2 unidades, 1 sin costo) — no depende de que se haya
          // agregado ninguna unidad extra a mano.
          if (promo?.tipoPromocion === "2x1") {
            const { pagadas, gratis } = desglose2x1(linea.cantidad);
            const filas = [];
            if (pagadas > 0) {
              filas.push({
                itemId: linea.itemId,
                nombreLibre: null,
                costoUnitario: null,
                cantidad: pagadas,
                precioUnitario: linea.precioUnitario,
                promocionId: null,
                descuentoAplicado: 0,
              });
            }
            if (gratis > 0) {
              filas.push({
                itemId: linea.itemId,
                nombreLibre: null,
                costoUnitario: null,
                cantidad: gratis,
                precioUnitario: 0,
                promocionId: promo.id,
                descuentoAplicado: linea.precioOriginal * gratis,
              });
            }
            return filas;
          }

          // Para "lleve X gratis", esta línea se paga a precio normal — la promoción
          // ya queda registrada por la línea gratis del regalo. Marcarla aquí también
          // inflaría el conteo de "unidades con descuento" en el desempeño de la promoción.
          const esDescuentoDirecto =
            promo?.tipoPromocion === "descuento_porcentaje" || promo?.tipoPromocion === "descuento_fijo";
          return [
            {
              itemId: linea.itemId || null,
              nombreLibre: linea.nombreLibre.trim() || null,
              costoUnitario: linea.costoUnitario === "" ? null : linea.costoUnitario,
              cantidad: linea.cantidad,
              precioUnitario: linea.precioUnitario,
              promocionId: esDescuentoDirecto ? linea.promocionId : null,
              descuentoAplicado: esDescuentoDirecto
                ? Math.max(0, linea.precioOriginal - linea.precioUnitario) * linea.cantidad
                : 0,
            },
          ];
        }),
      });
      if (resultado.error) {
        setError(resultado.error);
        setGuardando(false);
        return;
      }

      // Nos quedamos en esta pantalla para poder registrar la siguiente venta rápido,
      // en vez de mandar de vuelta al listado general.
      if (resultado.ventaId) {
        setUltimaVenta({
          id: resultado.ventaId,
          venceEn: Date.now() + SEGUNDOS_PARA_DESHACER * 1000,
        });
      }
      setLineas([nuevaLinea()]);
      setNombre("");
      setTelefono("");
      setEmail("");
      setContactoId(null);
      setSugerencias([]);
      setBusquedaClienteLista(false);
      setFecha(ahoraFecha());
      setHora(ahoraHora());
      setGuardando(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la venta.");
      setGuardando(false);
    }
  }

  const seccionCliente = (
    <section key="cliente" className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Cliente</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => actualizarNombre(e.target.value)}
            onFocus={() => setMostrarSugerencias(sugerencias.length > 0)}
            onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            placeholder="Nombre del cliente"
          />
          {mostrarSugerencias && sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Correo *</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>
    </section>
  );

  const seccionProductos = (
    <section key="productos" className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Productos</h2>
      <div className="space-y-3">
        {lineas.map((linea) => {
          if (linea.esGratis) {
            return (
              <div
                key={linea.key}
                className="grid grid-cols-12 items-end gap-2 rounded-lg bg-green-50 px-2 py-2"
              >
                <div className="col-span-6">
                  <p className="text-xs font-medium text-gray-700">Producto</p>
                  <p className="text-sm text-gray-900">{linea.busquedaProducto}</p>
                  <p className="text-xs text-green-700">Gratis (promoción)</p>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad *</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={linea.cantidad}
                    onChange={(e) =>
                      actualizarLinea(linea.key, { cantidad: cantidadDesdeInput(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <p className="text-xs font-medium text-gray-700">Precio unitario</p>
                  <p className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-500">
                    $0
                  </p>
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
            );
          }

          const aplicables = inventarioActivo ? promocionesAplicables(linea.itemId) : [];
          const promoSeleccionada = aplicables.find((p) => p.id === linea.promocionId) ?? null;

          if (!inventarioActivo) {
            return (
              <div key={linea.key} className="space-y-1">
                <div className="grid grid-cols-12 items-end gap-2">
                  <div className="relative col-span-4">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Qué vendiste *
                    </label>
                    <input
                      value={linea.nombreLibre}
                      onChange={(e) => escribirNombreLibre(linea.key, e.target.value)}
                      onFocus={() =>
                        actualizarLinea(linea.key, { mostrarSugerenciasProducto: true })
                      }
                      onBlur={() =>
                        setTimeout(
                          () => actualizarLinea(linea.key, { mostrarSugerenciasProducto: false }),
                          150,
                        )
                      }
                      placeholder="Ej. Camisa talla M"
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    />
                    {linea.mostrarSugerenciasProducto &&
                      filtrarSugerencias(sugerenciasProductos, linea.nombreLibre).length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
                          {filtrarSugerencias(sugerenciasProductos, linea.nombreLibre).map((s) => (
                            <li key={s}>
                              <button
                                type="button"
                                onMouseDown={() => seleccionarNombreLibre(linea.key, s)}
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                              >
                                {s}
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
                      step={1}
                      inputMode="numeric"
                      value={linea.cantidad}
                      onChange={(e) =>
                        actualizarLinea(linea.key, { cantidad: cantidadDesdeInput(e.target.value) })
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Precio unitario
                    </label>
                    <EntradaMoneda
                      value={String(linea.precioUnitario)}
                      onChange={(valor) =>
                        actualizarLinea(linea.key, { precioUnitario: Number(valor) || 0 })
                      }
                      className="w-full rounded-lg border border-gray-300 py-2 pl-6 pr-2 text-sm focus:border-gray-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Costo (opcional)
                    </label>
                    <EntradaMoneda
                      value={String(linea.costoUnitario)}
                      onChange={(valor) =>
                        actualizarLinea(linea.key, { costoUnitario: valor === "" ? "" : Number(valor) || 0 })
                      }
                      className="w-full rounded-lg border border-gray-300 py-2 pl-6 pr-2 text-sm focus:border-gray-500 focus:outline-none"
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
              </div>
            );
          }

          return (
            <div key={linea.key} className="space-y-1">
              <div className="grid grid-cols-12 items-end gap-2">
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
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                  {linea.mostrarSugerenciasProducto &&
                    filtrarItems(items, linea.busquedaProducto).length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
                        {filtrarItems(items, linea.busquedaProducto).map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onMouseDown={() => seleccionarProducto(linea.key, item)}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            >
                              {etiquetaProducto(item)}
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
                    step={1}
                    inputMode="numeric"
                    value={linea.cantidad}
                    onChange={(e) =>
                      actualizarLinea(linea.key, { cantidad: cantidadDesdeInput(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Precio unitario
                  </label>
                  <EntradaMoneda
                    value={String(linea.precioUnitario)}
                    onChange={(valor) =>
                      actualizarLinea(linea.key, { precioUnitario: Number(valor) || 0 })
                    }
                    className="w-full rounded-lg border border-gray-300 py-2 pl-6 pr-2 text-sm focus:border-gray-500 focus:outline-none"
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

              {linea.itemId &&
                (() => {
                  const itemSeleccionado = items.find((i) => i.id === linea.itemId);
                  if (!itemSeleccionado) return null;

                  if (itemSeleccionado.cantidad <= 0) {
                    return (
                      <div className="grid grid-cols-12 gap-2">
                        <p className="col-span-6 text-xs font-medium text-red-600">
                          Sin stock disponible — agrega inventario antes de vender este producto (
                          <Link
                            href={`/inventario/nuevo?nombre=${encodeURIComponent(itemSeleccionado.nombre)}`}
                            className="underline"
                          >
                            agregar ahora
                          </Link>
                          ).
                        </p>
                      </div>
                    );
                  }

                  const cantidadPedida = linea.cantidad === "" ? 0 : linea.cantidad;
                  if (cantidadPedida > itemSeleccionado.cantidad) {
                    return (
                      <div className="grid grid-cols-12 gap-2">
                        <p className="col-span-6 text-xs font-medium text-red-600">
                          Solo quedan {itemSeleccionado.cantidad} {etiquetaUnidad(itemSeleccionado.unidad)}{" "}
                          — no puedes vender {cantidadPedida}.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-12 gap-2">
                      <p className="col-span-6 text-xs text-gray-500">
                        Quedan {itemSeleccionado.cantidad} {etiquetaUnidad(itemSeleccionado.unidad)}
                        {itemSeleccionado.diasRestantes !== null ? (
                          <>
                            {" "}
                            — a este ritmo,{" "}
                            <span
                              className={
                                itemSeleccionado.diasRestantes <= 3
                                  ? "font-medium text-red-600"
                                  : itemSeleccionado.diasRestantes <= 7
                                    ? "font-medium text-amber-600"
                                    : ""
                              }
                            >
                              se {itemSeleccionado.diasRestantes === 0 ? "acaba hoy" : `acaba en ~${itemSeleccionado.diasRestantes} día(s)`}
                            </span>
                          </>
                        ) : (
                          " — aún no hay suficientes ventas para proyectar cuándo se acaba"
                        )}
                      </p>
                    </div>
                  );
                })()}

              {linea.itemId && aplicables.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pl-1">
                  <select
                    value={linea.promocionId ?? ""}
                    onChange={(e) => {
                      const promo = aplicables.find((p) => p.id === e.target.value) ?? null;
                      aplicarPromocion(linea, promo);
                    }}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
                  >
                    <option value="">Sin promoción</option>
                    {aplicables.map((promo) => (
                      <option key={promo.id} value={promo.id}>
                        {promo.nombre} ({etiquetaTipoPromocion[promo.tipoPromocion]})
                      </option>
                    ))}
                  </select>

                  {promoSeleccionada?.tipoPromocion === "2x1" &&
                    (() => {
                      const { pagadas, gratis } = desglose2x1(
                        linea.cantidad === "" ? 0 : linea.cantidad,
                      );
                      return (
                        <span className="text-xs text-green-700">
                          {gratis > 0
                            ? `De estas ${pagadas + gratis}, pagas ${pagadas} y ${gratis} son gratis (2x1)`
                            : "Agrega al menos 2 unidades para que aplique el 2x1"}
                        </span>
                      );
                    })()}
                  {promoSeleccionada?.tipoPromocion === "lleve_x_gratis" && (
                    <button
                      type="button"
                      onClick={() => agregarRegalo(promoSeleccionada)}
                      className="rounded-lg border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                    >
                      + Regalo: {promoSeleccionada.regaloNombre}
                    </button>
                  )}
                  {promoSeleccionada &&
                    (promoSeleccionada.tipoPromocion === "descuento_porcentaje" ||
                      promoSeleccionada.tipoPromocion === "descuento_fijo") && (
                      <span className="text-xs text-green-700">
                        Descuento:{" "}
                        {(
                          Math.max(0, linea.precioOriginal - linea.precioUnitario) *
                          (linea.cantidad === "" ? 0 : linea.cantidad)
                        ).toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                      </span>
                    )}
                </div>
              )}
            </div>
          );
        })}
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
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
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

  const secciones = !crmActivo
    ? [seccionProductos]
    : orden === "cliente-primero"
      ? [seccionCliente, seccionProductos]
      : [seccionProductos, seccionCliente];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar venta</h1>
        {crmActivo && (
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
        )}
      </div>

      {ultimaVenta && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <span>Venta agregada correctamente.</span>
          {segundosRestantes > 0 && (
            <button
              type="button"
              onClick={deshacer}
              disabled={deshaciendo}
              className="font-medium text-red-600 underline hover:text-red-700 disabled:opacity-50"
            >
              {deshaciendo ? "Deshaciendo..." : `Deshacer (${segundosRestantes}s)`}
            </button>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Hora</label>
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
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
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar venta"}
      </button>
    </div>
  );
}
