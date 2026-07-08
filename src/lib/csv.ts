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
