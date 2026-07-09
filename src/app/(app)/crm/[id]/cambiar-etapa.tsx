"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiarEtapa } from "./actions";

const etapas = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "propuesta", label: "Propuesta" },
  { value: "cerrado", label: "Cerrado" },
];

export function CambiarEtapa({
  contactoId,
  etapaActual,
}: {
  contactoId: string;
  etapaActual: string;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(etapaActual);
  const [guardando, setGuardando] = useState(false);

  async function onChange(valor: string) {
    setEtapa(valor);
    setGuardando(true);
    await cambiarEtapa(contactoId, valor);
    setGuardando(false);
    router.refresh();
  }

  return (
    <select
      value={etapa}
      onChange={(e) => onChange(e.target.value)}
      disabled={guardando}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
    >
      {etapas.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
