"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearCliente } from "./actions";

export function NuevoClienteForm() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [empresaCliente, setEmpresaCliente] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
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

    setGuardando(true);
    try {
      const resultado = await crearCliente({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        empresaCliente: empresaCliente.trim(),
      });
      if (resultado.error || !resultado.id) {
        setError(resultado.error ?? "No se pudo crear el cliente.");
        setGuardando(false);
        return;
      }
      router.push(`/crm/${resultado.id}?creado=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente.");
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Agregar cliente</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono *</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
            type="tel"
            inputMode="numeric"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Correo *</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Empresa (opcional)
          </label>
          <input
            value={empresaCliente}
            onChange={(e) => setEmpresaCliente(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">* Campos obligatorios</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar cliente"}
      </button>
    </div>
  );
}
