export type ColumnaCsv = {
  clave: string;
  titulo: string;
};

function escaparCelda(valor: string): string {
  if (/[",\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function generarCsv(
  filas: Record<string, string | number | null>[],
  columnas: ColumnaCsv[],
): string {
  const encabezado = columnas.map((c) => escaparCelda(c.titulo)).join(",");
  const lineas = filas.map((fila) =>
    columnas.map((c) => escaparCelda(String(fila[c.clave] ?? ""))).join(","),
  );
  return [encabezado, ...lineas].join("\r\n");
}

// Parser simple de CSV (soporta campos entre comillas con comas o saltos de
// línea adentro) — para leer plantillas que la persona sube, no cualquier CSV.
export function parsearCsv(texto: string): string[][] {
  const normalizado = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let dentroComillas = false;
  let i = 0;

  while (i < normalizado.length) {
    const c = normalizado[i];
    if (dentroComillas) {
      if (c === '"') {
        if (normalizado[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        dentroComillas = false;
        i++;
        continue;
      }
      campo += c;
      i++;
      continue;
    }
    if (c === '"') {
      dentroComillas = true;
      i++;
      continue;
    }
    if (c === ",") {
      fila.push(campo);
      campo = "";
      i++;
      continue;
    }
    if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      i++;
      continue;
    }
    campo += c;
    i++;
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((f) => f.some((celda) => celda.trim() !== ""));
}
