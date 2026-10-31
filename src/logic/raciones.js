// Cuánto come cada persona respecto a un adulto. Los peques cuentan media ración.
export const RACION_ADULTO = 1;
export const RACION_PEQUE = 0.5;

export function racionDe(persona) {
  const r = Number(persona?.racion);
  return r > 0 ? r : RACION_ADULTO;
}

export function esPeque(persona) {
  return racionDe(persona) < RACION_ADULTO;
}

// Raciones de adulto que hay que cocinar y comprar (al menos 1)
export function comensalesDe(personas) {
  const total = (personas || []).reduce((suma, p) => suma + racionDe(p), 0);
  return Math.max(1, Math.round(total * 100) / 100);
}

// «2» o «2 + 2 peques»
export function textoComensales(personas) {
  const lista = personas || [];
  const peques = lista.filter(esPeque).length;
  const adultos = lista.length - peques;
  if (!lista.length) return '1';
  if (!peques) return String(adultos);
  return `${adultos} + ${peques} ${peques === 1 ? 'peque' : 'peques'}`;
}
