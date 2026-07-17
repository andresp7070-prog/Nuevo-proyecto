"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { SignOutButton } from "@/components/signout-button";
import { registrarPedidoKiosko } from "./actions";

type Producto = {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  fotoUrl: string | null;
};

// Paleta a la medida de este cliente — pensada para poder cambiarse entera
// (colores, y más adelante tipografía/logo) sin tocar el resto de la
// pantalla, el día que el cliente confirme su identidad de marca real.
const TEMA = {
  tinta: "#3B2A1E",
  tintaSuave: "#8A7460",
  acento: "#C9702D",
  acentoSuave: "#F1DABB",
  tarjeta: "#FFFFFF",
  borde: "#EAE0D2",
};

// Fondo amaderado (roble claro, veta vertical) armado con capas de
// gradientes en vez de una imagen — así no depende de subir ni alojar
// ningún archivo. Varias franjas superpuestas a distinto ancho y opacidad
// imitan la veta irregular de la madera real.
const FONDO_MADERA: React.CSSProperties = {
  backgroundColor: "#D8B889",
  backgroundImage: [
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0px, transparent 3px, transparent 6px, rgba(120,80,40,0.07) 8px, transparent 12px)",
    "repeating-linear-gradient(90deg, rgba(140,95,50,0.10) 0px, transparent 2px, transparent 35px, rgba(140,95,50,0.06) 38px, transparent 70px)",
    "repeating-linear-gradient(90deg, rgba(90,55,25,0.05) 0px, transparent 90px, rgba(90,55,25,0.05) 92px, transparent 160px)",
    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.04))",
  ].join(", "),
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function LogoDatum() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M 24 42 A 18 18 0 1 1 36.321 37.122"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
    </svg>
  );
}

function PieDatum() {
  return (
    <div
      className="pointer-events-none fixed bottom-3 left-4 z-0 flex items-center gap-1.5 opacity-40"
      style={{ color: TEMA.tintaSuave }}
    >
      <LogoDatum />
      <span className="text-[11px]">Desarrollado por Datum</span>
    </div>
  );
}

function IconoTaza() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-10 w-10" aria-hidden="true">
      <path
        d="M9 16h24v14a9 9 0 0 1-9 9h-6a9 9 0 0 1-9-9V16Z"
        stroke={TEMA.acento}
        strokeWidth="2.2"
      />
      <path
        d="M33 20h3.5a5 5 0 0 1 0 10H33"
        stroke={TEMA.acento}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M15 10c0 2-2 2-2 4M22 10c0 2-2 2-2 4" stroke={TEMA.acento} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Kiosko({
  puntoId,
  nombrePunto,
  productos,
}: {
  puntoId: string;
  nombrePunto: string;
  productos: Producto[];
}) {
  const categorias = useMemo(() => {
    const vistas = new Set<string>();
    const orden: string[] = [];
    for (const p of productos) {
      if (!vistas.has(p.categoria)) {
        vistas.add(p.categoria);
        orden.push(p.categoria);
      }
    }
    return orden;
  }, [productos]);

  const [categoriaActiva, setCategoriaActiva] = useState(categorias[0] ?? "");
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [pantalla, setPantalla] = useState<"menu" | "listo">("menu");
  const [codigoPedido, setCodigoPedido] = useState<string | null>(null);
  const [errorPedido, setErrorPedido] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const [mostrarDatosCliente, setMostrarDatosCliente] = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");

  const productosVisibles = productos.filter((p) => p.categoria === categoriaActiva);
  const itemsCarrito = Object.entries(carrito).filter(([, cant]) => cant > 0);
  const totalUnidades = itemsCarrito.reduce((s, [, c]) => s + c, 0);
  const total = itemsCarrito.reduce((s, [id, c]) => {
    const p = productos.find((x) => x.id === id);
    return s + (p ? p.precio * c : 0);
  }, 0);

  function agregar(id: string) {
    setCarrito((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }

  function quitar(id: string) {
    setCarrito((c) => {
      const actual = c[id] ?? 0;
      if (actual <= 1) {
        return Object.fromEntries(Object.entries(c).filter(([clave]) => clave !== id));
      }
      return { ...c, [id]: actual - 1 };
    });
  }

  function confirmarPedido() {
    const items = itemsCarrito.map(([itemId, cantidad]) => {
      const p = productos.find((x) => x.id === itemId)!;
      return { itemId, cantidad, precioUnitario: p.precio };
    });

    // Solo se manda si dio nombre Y teléfono juntos — con solo uno de los
    // dos, registrar_venta() no puede reconocer si es el mismo cliente la
    // próxima vez y terminaría creando un contacto repetido en el CRM.
    const cliente =
      nombreCliente.trim() && telefonoCliente.trim()
        ? { nombre: nombreCliente.trim(), telefono: telefonoCliente.trim() }
        : undefined;

    startTransition(async () => {
      const resultado = await registrarPedidoKiosko(puntoId, items, cliente);
      if (resultado.error) {
        setErrorPedido(resultado.error);
        return;
      }
      setErrorPedido(null);
      setCodigoPedido(resultado.codigo ?? null);
      setPantalla("listo");
    });
  }

  function nuevoPedido() {
    setCarrito({});
    setCodigoPedido(null);
    setMostrarDatosCliente(false);
    setNombreCliente("");
    setTelefonoCliente("");
    setPantalla("menu");
  }

  // Vuelve sola a la pantalla de inicio después de un rato, como un kiosko real.
  useEffect(() => {
    if (pantalla !== "listo") return;
    const t = setTimeout(nuevoPedido, 12000);
    return () => clearTimeout(t);
  }, [pantalla]);

  if (pantalla === "listo") {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ ...FONDO_MADERA, color: TEMA.tinta }}
      >
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: TEMA.acentoSuave }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12" aria-hidden="true">
            <path d="M4 12l5 5L20 6" stroke={TEMA.acento} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-lg" style={{ color: TEMA.tintaSuave }}>
          ¡Pedido recibido!
        </p>
        <p className="mt-2 text-6xl font-bold tracking-tight">{codigoPedido}</p>
        <p className="mt-4 max-w-xs text-base" style={{ color: TEMA.tintaSuave }}>
          Muestra este código en el mostrador para pagar y recoger tu pedido.
        </p>
        <button
          type="button"
          onClick={nuevoPedido}
          className="mt-10 rounded-full px-8 py-3 text-base font-semibold text-white"
          style={{ background: TEMA.acento }}
        >
          Hacer otro pedido
        </button>
        <PieDatum />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ ...FONDO_MADERA, color: TEMA.tinta }}>
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <IconoTaza />
          <div>
            <p className="text-2xl font-bold leading-tight">Café del Mensajero</p>
            <p className="text-sm" style={{ color: TEMA.tintaSuave }}>
              {nombrePunto} · pide aquí
            </p>
          </div>
        </div>
        {/* Discreto, para el personal — no pensado para que el cliente lo toque */}
        <div className="opacity-40 hover:opacity-100">
          <SignOutButton />
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto px-8 pb-4">
        {categorias.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoriaActiva(cat)}
            className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold"
            style={
              cat === categoriaActiva
                ? { background: TEMA.acento, color: "white" }
                : { background: TEMA.tarjeta, color: TEMA.tinta, border: `1px solid ${TEMA.borde}` }
            }
          >
            {cat}
          </button>
        ))}
      </nav>

      <main className="flex-1 px-8 pb-40">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {productosVisibles.map((p) => {
            const cantidad = carrito[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="flex flex-col rounded-2xl p-4"
                style={{ background: TEMA.tarjeta, border: `1px solid ${TEMA.borde}` }}
              >
                <div
                  className="mb-3 flex h-24 items-center justify-center rounded-xl"
                  style={{ background: TEMA.acentoSuave }}
                >
                  {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.fotoUrl} alt={p.nombre} className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <IconoTaza />
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug">{p.nombre}</p>
                <p className="mt-1 text-sm" style={{ color: TEMA.tintaSuave }}>
                  {formatoMoneda(p.precio)}
                </p>

                <div className="mt-3">
                  {cantidad === 0 ? (
                    <button
                      type="button"
                      onClick={() => agregar(p.id)}
                      className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                      style={{ background: TEMA.acento }}
                    >
                      Agregar
                    </button>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg" style={{ background: TEMA.acentoSuave }}>
                      <button
                        type="button"
                        onClick={() => quitar(p.id)}
                        className="px-3 py-2 text-lg font-bold"
                        style={{ color: TEMA.acento }}
                        aria-label={`Quitar ${p.nombre}`}
                      >
                        −
                      </button>
                      <span className="text-sm font-semibold">{cantidad}</span>
                      <button
                        type="button"
                        onClick={() => agregar(p.id)}
                        className="px-3 py-2 text-lg font-bold"
                        style={{ color: TEMA.acento }}
                        aria-label={`Agregar otro ${p.nombre}`}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {productosVisibles.length === 0 && (
            <p className="col-span-full py-12 text-center" style={{ color: TEMA.tintaSuave }}>
              No hay productos en esta categoría.
            </p>
          )}
        </div>
      </main>

      {totalUnidades > 0 && (
        <div className="fixed inset-x-0 bottom-0" style={{ background: TEMA.tinta }}>
          {mostrarDatosCliente ? (
            <div className="flex flex-wrap items-end gap-3 border-b border-white/10 px-8 py-3">
              <div>
                <label className="mb-1 block text-xs text-white/60">Tu nombre</label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  placeholder="Opcional"
                  className="rounded-lg border-0 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Tu teléfono</label>
                <input
                  type="tel"
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                  placeholder="Opcional"
                  className="rounded-lg border-0 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setMostrarDatosCliente(false)}
                className="pb-2 text-xs font-medium text-white/60 underline"
              >
                Ocultar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMostrarDatosCliente(true)}
              className="w-full border-b border-white/10 px-8 py-2 text-left text-xs font-medium text-white/60 underline"
            >
              ¿Nos compartes tu nombre y teléfono? (opcional)
            </button>
          )}

          <div className="flex items-center justify-between px-8 py-5">
            <div className="text-white">
              <p className="text-xs opacity-70">
                {totalUnidades} {totalUnidades === 1 ? "producto" : "productos"}
              </p>
              <p className="text-xl font-bold">{formatoMoneda(total)}</p>
            </div>
            <button
              type="button"
              onClick={confirmarPedido}
              disabled={enviando}
              className="rounded-full px-8 py-3 text-base font-semibold text-white disabled:opacity-60"
              style={{ background: TEMA.acento }}
            >
              {enviando ? "Enviando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      )}

      {errorPedido && (
        <div className="fixed inset-x-0 bottom-24 flex justify-center px-8">
          <p className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">{errorPedido}</p>
        </div>
      )}

      {totalUnidades === 0 && <PieDatum />}
    </div>
  );
}
