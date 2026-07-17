"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errorTamanoFoto } from "@/lib/fotos";
import { actualizarFotoPath } from "./actions";

const BUCKET = "inventario-fotos";

// Sube directo del navegador a Supabase Storage (en vez de pasar por una
// Server Action) por dos razones: evita el límite de tamaño de las Server
// Actions, y permite mostrar el progreso real de la subida — algo que una
// Server Action no expone.
export function FotoProducto({
  itemId,
  empresaId,
  fotoUrl,
}: {
  itemId: string;
  empresaId: string;
  fotoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function subir(file: File) {
    setError(null);
    setSubiendo(true);
    setProgreso(0);

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("No hay sesión activa — vuelve a iniciar sesión e intenta de nuevo.");

        const extension = file.name.split(".").pop() ?? "jpg";
        const path = `${empresaId}/${itemId}/${Date.now()}.${extension}`;
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url, true);
          xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
          xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.setRequestHeader("x-upsert", "true");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`No se pudo subir la foto (código ${xhr.status}). Intenta de nuevo.`));
            }
          };
          xhr.onerror = () => reject(new Error("Falló la conexión al subir la foto. Revisa tu internet e intenta de nuevo."));
          xhr.send(file);
        });

        const resultado = await actualizarFotoPath({ itemId, path });
        if (resultado.error) throw new Error(resultado.error);

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
      } finally {
        setSubiendo(false);
        setPreviewUrl(null);
        URL.revokeObjectURL(preview);
        if (inputRef.current) inputRef.current.value = "";
      }
    })();
  }

  const urlMostrada = previewUrl ?? fotoUrl;

  return (
    <div className="flex flex-col items-center gap-2">
      {urlMostrada ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlMostrada}
          alt="Foto del producto"
          className="h-24 w-24 rounded-xl border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400">
          Sin foto
        </div>
      )}

      {subiendo && (
        <div className="w-24">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-accent transition-all"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[10px] text-gray-400">Subiendo... {progreso}%</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const errorValidacion = errorTamanoFoto(file);
          if (errorValidacion) {
            setError(errorValidacion);
            if (inputRef.current) inputRef.current.value = "";
            return;
          }
          subir(file);
        }}
        disabled={subiendo}
        className="w-24 text-xs file:mr-1 file:rounded-lg file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
      />
      {error && <p className="max-w-32 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
