"use client";

import { useState } from "react";

export type Barra = {
  etiqueta: string;
  valor: number;
  textoValor: string;
  tono?: "default" | "positivo" | "negativo" | "alerta";
};

const COLOR: Record<NonNullable<Barra["tono"]>, string> = {
  default: "#2a78d6",
  positivo: "#0ca30c",
  negativo: "#d03b3b",
  alerta: "#d03b3b",
};

function tonoAutomatico(valor: number): NonNullable<Barra["tono"]> {
  return valor < 0 ? "negativo" : "default";
}

export function GraficoBarras({
  datos,
  alto = 160,
}: {
  datos: Barra[];
  alto?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (datos.length === 0) return null;

  const anchoBarra = 48;
  const espacio = 16;
  const ancho = datos.length * (anchoBarra + espacio) + espacio;
  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.valor)));
  const hayNegativos = datos.some((d) => d.valor < 0);
  const baseY = hayNegativos ? alto / 2 : alto - 8;
  const escala = (hayNegativos ? alto / 2 - 20 : alto - 8 - 20) / maxAbs;

  return (
    <div className="overflow-x-auto">
      <svg
        width={ancho}
        height={alto + 24}
        role="img"
        aria-label="Gráfico de barras"
        className="min-w-full"
      >
        <line x1={0} y1={baseY} x2={ancho} y2={baseY} stroke="#c3c2b7" strokeWidth={1} />
        {datos.map((d, i) => {
          const x = espacio + i * (anchoBarra + espacio);
          const h = Math.max(Math.abs(d.valor) * escala, 1);
          const y = d.valor >= 0 ? baseY - h : baseY;
          const color = COLOR[d.tono ?? tonoAutomatico(d.valor)];
          const activo = hover === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
            >
              <rect
                x={x}
                y={y}
                width={anchoBarra}
                height={h}
                rx={4}
                fill={color}
                opacity={activo ? 1 : 0.85}
              />
              <text
                x={x + anchoBarra / 2}
                y={d.valor >= 0 ? y - 6 : y + h + 14}
                textAnchor="middle"
                fontSize={11}
                fill="#52514e"
              >
                {d.textoValor}
              </text>
              <text
                x={x + anchoBarra / 2}
                y={alto + 18}
                textAnchor="middle"
                fontSize={11}
                fill="#898781"
              >
                {d.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type PuntoLinea = {
  etiqueta: string;
  valor: number;
  textoValor: string;
  mostrarEtiqueta?: boolean;
};

export function GraficoLinea({
  puntos,
  alto = 160,
}: {
  puntos: PuntoLinea[];
  alto?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (puntos.length === 0) return null;

  const pasoX = 28;
  const margen = 16;
  const ancho = (puntos.length - 1) * pasoX + margen * 2;
  const ejeY = alto - 24;
  const max = Math.max(1, ...puntos.map((p) => p.valor));
  const escala = (ejeY - 16) / max;

  const coords = puntos.map((p, i) => ({
    x: margen + i * pasoX,
    y: ejeY - p.valor * escala,
  }));

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        width={ancho}
        height={alto}
        role="img"
        aria-label="Gráfico de línea"
        className="min-w-full"
      >
        <line x1={margen} y1={ejeY} x2={ancho - margen} y2={ejeY} stroke="#e1e0d9" strokeWidth={1} />
        <path d={path} fill="none" stroke="#2a78d6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default"
          >
            <rect x={c.x - pasoX / 2} y={0} width={pasoX} height={alto} fill="transparent" />
            <circle cx={c.x} cy={c.y} r={hover === i ? 5 : 3} fill="#2a78d6" />
            {puntos[i].mostrarEtiqueta && (
              <text x={c.x} y={alto - 6} textAnchor="middle" fontSize={10} fill="#898781">
                {puntos[i].etiqueta}
              </text>
            )}
            {hover === i && (
              <g>
                <rect
                  x={c.x - 28}
                  y={Math.max(c.y - 26, 0)}
                  width={56}
                  height={18}
                  rx={4}
                  fill="#0b0b0b"
                />
                <text
                  x={c.x}
                  y={Math.max(c.y - 26, 0) + 13}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#ffffff"
                >
                  {puntos[i].textoValor}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function GraficoBarrasHorizontal({ datos }: { datos: Barra[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (datos.length === 0) return null;

  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.valor)));

  return (
    <div className="space-y-1.5">
      {datos.map((d, i) => {
        const ancho = (Math.abs(d.valor) / maxAbs) * 100;
        const color = COLOR[d.tono ?? tonoAutomatico(d.valor)];
        return (
          <div
            key={i}
            className="flex items-center gap-2 text-xs"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-36 shrink-0 truncate text-gray-600" title={d.etiqueta}>
              {d.etiqueta}
            </span>
            <div className="h-4 flex-1 rounded-lg bg-gray-100">
              <div
                className="h-4 rounded-lg transition-opacity"
                style={{
                  width: `${Math.max(ancho, 2)}%`,
                  backgroundColor: color,
                  opacity: hover === i ? 1 : 0.85,
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-gray-700">{d.textoValor}</span>
          </div>
        );
      })}
    </div>
  );
}
