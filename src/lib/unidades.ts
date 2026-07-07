export type Dimension = "conteo" | "peso" | "volumen" | "longitud";

export type Unidad = {
  valor: string;
  etiqueta: string;
  dimension: Dimension;
  factor: number; // cuántas unidades "base" de su dimensión equivalen a 1 de esta unidad
};

export const UNIDADES: Unidad[] = [
  { valor: "unidad", etiqueta: "Unidad", dimension: "conteo", factor: 1 },
  { valor: "gramo", etiqueta: "Gramo (g)", dimension: "peso", factor: 1 },
  { valor: "kilogramo", etiqueta: "Kilogramo (kg)", dimension: "peso", factor: 1000 },
  { valor: "libra", etiqueta: "Libra (lb)", dimension: "peso", factor: 453.592 },
  { valor: "onza_peso", etiqueta: "Onza (peso)", dimension: "peso", factor: 28.3495 },
  { valor: "mililitro", etiqueta: "Mililitro (ml)", dimension: "volumen", factor: 1 },
  { valor: "litro", etiqueta: "Litro (L)", dimension: "volumen", factor: 1000 },
  { valor: "galon", etiqueta: "Galón", dimension: "volumen", factor: 3785.41 },
  { valor: "onza_liquida", etiqueta: "Onza líquida", dimension: "volumen", factor: 29.5735 },
  { valor: "centimetro", etiqueta: "Centímetro (cm)", dimension: "longitud", factor: 1 },
  { valor: "metro", etiqueta: "Metro (m)", dimension: "longitud", factor: 100 },
];

export function buscarUnidad(valor: string): Unidad | undefined {
  return UNIDADES.find((u) => u.valor === valor);
}

export function etiquetaUnidad(valor: string): string {
  return buscarUnidad(valor)?.etiqueta ?? valor;
}

export function unidadesDeLaMismaDimension(valorUnidad: string): Unidad[] {
  const unidad = buscarUnidad(valorUnidad);
  if (!unidad) return [];
  return UNIDADES.filter((u) => u.dimension === unidad.dimension);
}

// Convierte una cantidad de una unidad a otra, siempre y cuando sean de la
// misma dimensión (no se puede convertir peso a volumen, por ejemplo).
export function convertir(cantidad: number, deUnidad: string, aUnidad: string): number {
  if (deUnidad === aUnidad) return cantidad;
  const de = buscarUnidad(deUnidad);
  const a = buscarUnidad(aUnidad);
  if (!de || !a || de.dimension !== a.dimension) {
    throw new Error("No se puede convertir entre esas unidades.");
  }
  return (cantidad * de.factor) / a.factor;
}
