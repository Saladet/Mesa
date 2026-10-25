// Formato de cantidades en español: "160 g", "2 dientes", "½ bote", "1,2 kg".

const FRACCIONES = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

const UNIDADES = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  ud: ['', ''],
  diente: ['diente', 'dientes'],
  cda: ['cda', 'cdas'],
  cdta: ['cdta', 'cdtas'],
  pizca: ['pizca', 'pizcas'],
  bote: ['bote', 'botes'],
  lata: ['lata', 'latas'],
  rebanada: ['rebanada', 'rebanadas'],
  hoja: ['hoja', 'hojas'],
  manojo: ['manojo', 'manojos'],
  tarrina: ['tarrina', 'tarrinas'],
  rama: ['rama', 'ramas'],
  paquete: ['paquete', 'paquetes'],
};

// Unidades que en la lista de la compra no llevan cantidad (se compra el paquete).
const SIN_CANTIDAD_EN_LISTA = new Set(['cda', 'cdta', 'pizca', 'al_gusto', 'hoja']);
// Unidades que se redondean hacia arriba en la lista.
const ENTERAS_EN_LISTA = new Set(['ud', 'bote', 'lata', 'tarrina', 'paquete', 'manojo', 'rebanada', 'rama', 'diente']);

export function numero(n) {
  const entero = Math.floor(n + 1e-9);
  const resto = Math.round((n - entero) * 100) / 100;
  if (resto === 0) return String(entero);
  if (FRACCIONES[resto]) return entero ? `${entero} ${FRACCIONES[resto]}` : FRACCIONES[resto];
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

// 2.25 -> "2,25"; 1.2 -> "1,2"; 3 -> "3"
export function decimal(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export function formatoCantidad(cantidad, unidad) {
  if (unidad === 'al_gusto' || cantidad == null) return 'Al gusto';
  const c = Number(cantidad);
  if (unidad === 'g' && c >= 1000) return `${decimal(c / 1000)} kg`;
  if (unidad === 'ml' && c >= 1000) return `${decimal(c / 1000)} l`;
  const [singular, plural] = UNIDADES[unidad] || [unidad || '', unidad || ''];
  const etiqueta = c > 1 ? plural : singular;
  return etiqueta ? `${numero(c)} ${etiqueta}` : numero(c);
}

export function escalar(cantidad, unidad, factor) {
  if (cantidad == null || factor === 1) return cantidad;
  const c = Number(cantidad) * factor;
  if (unidad === 'g' || unidad === 'ml') return Math.round(c / 5) * 5;
  return Math.round(c * 2) / 2;
}

// Cantidad para la lista de la compra (o null si no hace falta ponerla)
export function cantidadCompra(cantidad, unidad) {
  if (cantidad == null || SIN_CANTIDAD_EN_LISTA.has(unidad)) return null;
  const c = Number(cantidad);
  if (ENTERAS_EN_LISTA.has(unidad)) return formatoCantidad(Math.ceil(c - 1e-9), unidad);
  if (unidad === 'g' || unidad === 'ml') {
    const r = c >= 300 ? Math.ceil(c / 50) * 50 : Math.ceil(c / 5) * 5;
    return formatoCantidad(r, unidad);
  }
  return formatoCantidad(c, unidad);
}
