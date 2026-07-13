import { sinTildes } from "./texto";

export type Dimension = "conteo" | "peso" | "volumen" | "longitud";

export type Unidad = {
  valor: string;
  etiqueta: string;
  dimension: Dimension;
  factor: number; // cuántas unidades "base" de su dimensión equivalen a 1 de esta unidad
};

export const UNIDADES: Unidad[] = [
  { valor: "unidad", etiqueta: "Unidades", dimension: "conteo", factor: 1 },
  { valor: "gramo", etiqueta: "Gramo (g)", dimension: "peso", factor: 1 },
  { valor: "kilogramo", etiqueta: "Kilogramo (kg)", dimension: "peso", factor: 1000 },
  { valor: "libra", etiqueta: "Libra (lb)", dimension: "peso", factor: 453.592 },
  { valor: "onza_peso", etiqueta: "Onza (peso)", dimension: "peso", factor: 28.3495 },
  { valor: "mililitro", etiqueta: "Mililitro (ml)", dimension: "volumen", factor: 1 },
  { valor: "litro", etiqueta: "Litro (L)", dimension: "volumen", factor: 1000 },
  { valor: "galon", etiqueta: "Galón", dimension: "volumen", factor: 3785.41 },
  { valor: "onza_liquida", etiqueta: "Onza líquida", dimension: "volumen", factor: 29.5735 },
  { valor: "garrafa", etiqueta: "Garrafa (20 L)", dimension: "volumen", factor: 20000 },
  { valor: "centimetro", etiqueta: "Centímetro (cm)", dimension: "longitud", factor: 1 },
  { valor: "metro", etiqueta: "Metro (m)", dimension: "longitud", factor: 100 },
];

export function buscarUnidad(valor: string): Unidad | undefined {
  return UNIDADES.find((u) => u.valor === valor);
}

// Formas comunes en que alguien escribiría cada unidad a mano (sin tildes,
// minúsculas) — para la carga masiva de inventario, donde la persona no
// elige de una lista sino que escribe en un CSV.
const SINONIMOS_UNIDAD: Record<string, string> = {
  unidad: "unidad",
  unidades: "unidad",
  und: "unidad",
  un: "unidad",
  u: "unidad",
  gramo: "gramo",
  gramos: "gramo",
  gr: "gramo",
  g: "gramo",
  kilogramo: "kilogramo",
  kilogramos: "kilogramo",
  kilo: "kilogramo",
  kilos: "kilogramo",
  kg: "kilogramo",
  libra: "libra",
  libras: "libra",
  lb: "libra",
  lbs: "libra",
  onza: "onza_peso",
  onzas: "onza_peso",
  oz: "onza_peso",
  "onza peso": "onza_peso",
  mililitro: "mililitro",
  mililitros: "mililitro",
  ml: "mililitro",
  litro: "litro",
  litros: "litro",
  lt: "litro",
  l: "litro",
  galon: "galon",
  galones: "galon",
  gal: "galon",
  "onza liquida": "onza_liquida",
  "onza_liquida": "onza_liquida",
  "oz liquida": "onza_liquida",
  garrafa: "garrafa",
  garrafas: "garrafa",
  centimetro: "centimetro",
  centimetros: "centimetro",
  cm: "centimetro",
  metro: "metro",
  metros: "metro",
  m: "metro",
  mt: "metro",
  mts: "metro",
};

// Convierte lo que alguien haya escrito a mano ("Kg", "litros", "GALONES")
// al código interno exacto que usa el sistema. Si no reconoce nada, cae en
// "unidad" — nunca deja pasar un valor que no signifique nada en el sistema.
export function normalizarUnidad(textoLibre: string): { valor: string; reconocida: boolean } {
  const limpio = sinTildes(textoLibre.trim());

  if (!limpio) return { valor: "unidad", reconocida: true };

  const valor = SINONIMOS_UNIDAD[limpio];
  if (valor) return { valor, reconocida: true };

  return { valor: "unidad", reconocida: false };
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
