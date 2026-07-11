"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ahoraFecha } from "@/lib/fecha";
import { agregarInteraccion } from "./actions";

const tipos = [
  { value: "llamada", label: "Llamada" },
  { value: "email", label: "Correo" },
  { value: "reunion", label: "Reunión" },
  { value: "otro", label: "Otro" },
];

export function NuevaInteraccionForm({ contactoId }: { contactoId: string }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(ahoraFecha());
  const [tipo, setTipo] = useState("llamada");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    if (!nota.trim()) {
      setError("Escribe una nota.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await agregarInteraccion({ contactoId, fecha, tipo, nota: nota.trim() });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setNota("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la interacción.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          {tipos.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota *"
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none sm:col-span-2"
        />
      </div>

      <p className="mt-2 text-xs text-gray-400">* Campo obligatorio</p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Agregar interacción"}
      </button>
    </div>
  );
}
