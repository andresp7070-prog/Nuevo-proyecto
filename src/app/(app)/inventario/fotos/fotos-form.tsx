"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errorTamanoFoto } from "@/lib/fotos";
import { comprimirImagen, TAMANO_MAXIMO_ORIGINAL_BYTES } from "@/lib/imagenes";
import { sinTildes } from "@/lib/texto";
import { actualizarFotoPath } from "../[id]/actions";

const BUCKET = "inventario-fotos";

type PuntoVenta = { id: string; nombre: string };

type Item = {
  id: string;
  nombre: string;
  punto_venta_id: string | null;
  foto_path: string | null;
};

type Estado = "pendiente" | "subiendo" | "exito" | "error";

type Fila = {
  key: string;
  file: File;
  itemId: string | null;
  estado: Estado;
  progreso: number;
  error: string | null;
  // Archivo que ya se sabe demasiado pesado antes de intentar comprimirlo —
  // no tiene sentido reintentarlo al hacer clic en "Subir" de nuevo.
  bloqueada: boolean;
};

function normalizar(texto: string) {
  return sinTildes(texto.replace(/[_-]+/g, " ")).trim().replace(/\s+/g, " ");
}

function nombreSinExtension(nombreArchivo: string) {
  return nombreArchivo.replace(/\.[^.]+$/, "");
}

// Empareja el nombre del archivo con un producto: primero busca coincidencia
// exacta (ignorando tildes, mayúsculas y guiones/guiones bajos); si no hay
// exacta, busca coincidencia parcial pero solo la usa si es la única posible
// — mejor dejarlo sin emparejar que arriesgar una asignación equivocada.
function emparejar(nombreArchivo: string, items: Item[]): string | null {
  const q = normalizar(nombreSinExtension(nombreArchivo));
  if (!q) return null;

  const exacto = items.find((item) => normalizar(item.nombre) === q);
  if (exacto) return exacto.id;

  const parciales = items.filter((item) => {
    const n = normalizar(item.nombre);
    return n.includes(q) || q.includes(n);
  });
  if (parciales.length === 1) return parciales[0].id;

  return null;
}

export function FotosMasivasForm({
  empresaId,
  items,
  puntosVenta,
  puntoInicial,
}: {
  empresaId: string;
  items: Item[];
  puntosVenta: PuntoVenta[];
  puntoInicial: string | null;
}) {
  const router = useRouter();
  const usaPuntos = puntosVenta.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);

  const [puntoVentaId, setPuntoVentaId] = useState(puntoInicial ?? "");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [subiendoTodo, setSubiendoTodo] = useState(false);

  const itemsDelPunto = usaPuntos
    ? items.filter((item) => item.punto_venta_id === puntoVentaId)
    : items;

  function cambiarPunto(nuevoPuntoId: string) {
    setPuntoVentaId(nuevoPuntoId);
    const itemsNuevoPunto = items.filter((item) => item.punto_venta_id === nuevoPuntoId);
    setFilas((prev) =>
      prev.map((fila) => ({ ...fila, itemId: emparejar(fila.file.name, itemsNuevoPunto) })),
    );
  }

  function agregarArchivos(archivos: FileList) {
    const nuevas: Fila[] = Array.from(archivos).map((file) => {
      const demasiadoPesado = file.size > TAMANO_MAXIMO_ORIGINAL_BYTES;
      return {
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        itemId: emparejar(file.name, itemsDelPunto),
        estado: demasiadoPesado ? "error" : "pendiente",
        progreso: 0,
        error: demasiadoPesado ? "El archivo es demasiado grande — elige uno más liviano." : null,
        bloqueada: demasiadoPesado,
      };
    });
    setFilas((prev) => [...prev, ...nuevas]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function quitarFila(key: string) {
    setFilas((prev) => prev.filter((f) => f.key !== key));
  }

  function cambiarItemFila(key: string, itemId: string) {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, itemId: itemId || null } : f)));
  }

  async function subirFila(fila: Fila): Promise<Fila> {
    if (!fila.itemId) return { ...fila, estado: "error", error: "Elige a qué producto corresponde." };

    try {
      const archivo = await comprimirImagen(fila.file);
      const errorValidacion = errorTamanoFoto(archivo);
      if (errorValidacion) throw new Error(errorValidacion);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa — vuelve a iniciar sesión e intenta de nuevo.");

      const extension = archivo.name.split(".").pop() ?? "jpg";
      const path = `${empresaId}/${fila.itemId}/${Date.now()}.${extension}`;
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        xhr.setRequestHeader("Content-Type", archivo.type || "application/octet-stream");
        xhr.setRequestHeader("x-upsert", "true");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progreso = Math.round((e.loaded / e.total) * 100);
            setFilas((prev) => prev.map((f) => (f.key === fila.key ? { ...f, progreso } : f)));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`No se pudo subir (código ${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Falló la conexión al subir la foto."));
        xhr.send(archivo);
      });

      const resultado = await actualizarFotoPath({ itemId: fila.itemId, path });
      if (resultado.error) throw new Error(resultado.error);

      return { ...fila, estado: "exito", progreso: 100, error: null };
    } catch (err) {
      return {
        ...fila,
        estado: "error",
        error: err instanceof Error ? err.message : "No se pudo subir la foto.",
      };
    }
  }

  async function subirTodas() {
    setSubiendoTodo(true);
    const pendientes = filas.filter(
      (f) => !f.bloqueada && (f.estado === "pendiente" || f.estado === "error"),
    );
    for (const fila of pendientes) {
      setFilas((prev) => prev.map((f) => (f.key === fila.key ? { ...f, estado: "subiendo", error: null } : f)));
      const resultado = await subirFila(fila);
      setFilas((prev) => prev.map((f) => (f.key === fila.key ? resultado : f)));
    }
    setSubiendoTodo(false);
    router.refresh();
  }

  const totalListas = filas.filter((f) => f.itemId && f.estado !== "exito" && !f.bloqueada).length;
  const totalExito = filas.filter((f) => f.estado === "exito").length;
  const totalSubiendo = filas.filter((f) => f.estado === "subiendo").length;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Subir fotos masivamente</h1>
      <p className="mb-6 max-w-2xl text-sm text-gray-500">
        Elige varias fotos a la vez. Si el nombre del archivo coincide con el nombre de un
        producto (por ejemplo &ldquo;Coca Cola 400ml.jpg&rdquo; para el producto &ldquo;Coca Cola
        400ml&rdquo;), se empareja solo. Si no encuentra el producto, puedes elegirlo a mano antes
        de subir.
      </p>

      {usaPuntos && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Punto de venta</label>
          <select
            value={puntoVentaId}
            onChange={(e) => cambiarPunto(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="">Elige un punto</option>
            {puntosVenta.map((punto) => (
              <option key={punto.id} value={punto.id}>
                {punto.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        disabled={usaPuntos && !puntoVentaId}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) agregarArchivos(e.target.files);
        }}
        className="mb-6 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm disabled:opacity-50"
      />
      {usaPuntos && !puntoVentaId && (
        <p className="mb-6 -mt-4 text-xs text-gray-400">Elige primero un punto de venta.</p>
      )}

      {filas.length > 0 && (
        <>
          <ul className="mb-4 divide-y divide-gray-200 rounded-xl border border-gray-200">
            {filas.map((fila) => (
              <li key={fila.key} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">{fila.file.name}</p>
                  {fila.itemId ? (
                    <select
                      value={fila.itemId}
                      disabled={fila.estado === "subiendo" || fila.estado === "exito"}
                      onChange={(e) => cambiarItemFila(fila.key, e.target.value)}
                      className="mt-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none disabled:opacity-50"
                    >
                      {itemsDelPunto.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value=""
                      disabled={fila.estado === "subiendo"}
                      onChange={(e) => cambiarItemFila(fila.key, e.target.value)}
                      className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 focus:border-amber-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Sin coincidir — elige el producto</option>
                      {itemsDelPunto.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                  {fila.estado === "subiendo" && (
                    <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-accent transition-all"
                        style={{ width: `${fila.progreso}%` }}
                      />
                    </div>
                  )}
                  {fila.error && <p className="mt-1 text-xs text-red-600">{fila.error}</p>}
                </div>

                <div className="shrink-0 text-xs">
                  {fila.estado === "exito" && <span className="text-green-600">Subida ✓</span>}
                  {fila.estado === "subiendo" && <span className="text-gray-400">{fila.progreso}%</span>}
                </div>

                {fila.estado !== "subiendo" && (
                  <button
                    type="button"
                    onClick={() => quitarFila(fila.key)}
                    className="shrink-0 text-xs text-gray-400 hover:text-red-600"
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={subirTodas}
              disabled={subiendoTodo || totalListas === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {subiendoTodo
                ? `Subiendo${totalSubiendo > 0 ? ` (${totalSubiendo})` : ""}...`
                : `Subir ${totalListas > 0 ? totalListas : ""} foto${totalListas === 1 ? "" : "s"}`}
            </button>
            {totalExito > 0 && (
              <p className="text-sm text-gray-500">{totalExito} foto(s) subidas correctamente.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
