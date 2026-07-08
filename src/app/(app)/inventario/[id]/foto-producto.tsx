"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorTamanoFoto } from "@/lib/fotos";
import { subirFotoProducto } from "./actions";

export function FotoProducto({ itemId, fotoUrl }: { itemId: string; fotoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(file: File) {
    setError(null);
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.set("itemId", itemId);
      formData.set("foto", file);
      const resultado = await subirFotoProducto(formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoUrl}
          alt="Foto del producto"
          className="h-24 w-24 rounded-lg border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
          {subiendo ? "Subiendo..." : "Sin foto"}
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
        className="w-24 text-xs file:mr-1 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
      />
      {error && <p className="max-w-32 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
