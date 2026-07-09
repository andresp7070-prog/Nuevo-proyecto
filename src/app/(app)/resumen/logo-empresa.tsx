"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorTamanoFoto, TAMANO_MAXIMO_LOGO_BYTES } from "@/lib/fotos";
import { subirLogoEmpresa } from "./actions";

export function LogoEmpresa({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(file: File) {
    setError(null);
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.set("logo", file);
      const resultado = await subirLogoEmpresa(formData);
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
    <div className="flex flex-col items-end gap-1">
      <label className="group relative cursor-pointer">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo de la empresa"
            className="h-12 w-12 rounded-lg border border-gray-200 object-contain bg-white"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] text-gray-400 group-hover:border-gray-400">
            {subiendo ? "..." : "+ Logo"}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const errorValidacion = errorTamanoFoto(file, TAMANO_MAXIMO_LOGO_BYTES);
            if (errorValidacion) {
              setError(errorValidacion);
              if (inputRef.current) inputRef.current.value = "";
              return;
            }
            subir(file);
          }}
          disabled={subiendo}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      {error && <p className="max-w-32 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
