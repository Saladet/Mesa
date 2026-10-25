// Fechas como texto 'AAAA-MM-DD' en hora local. Se trabaja a mediodía para que los cambios de hora no muevan el día.

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function parseFecha(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isoFecha(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hoyISO() {
  return isoFecha(new Date());
}

export function sumarDias(s, n) {
  const d = parseFecha(s);
  d.setDate(d.getDate() + n);
  return isoFecha(d);
}

export function diaSemana(s) {
  return parseFecha(s).getDay();
}

// Días desde `desde` hasta `hasta` (positivo si `hasta` es posterior)
export function diasEntre(desde, hasta) {
  return Math.round((parseFecha(hasta) - parseFecha(desde)) / 86400000);
}

export function diasDeSemana(inicio) {
  return Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
}

export function capital(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// "26 oct – 1 nov"
export function rangoSemana(inicio) {
  const a = parseFecha(inicio);
  const b = parseFecha(sumarDias(inicio, 6));
  const ia = `${a.getDate()} ${MESES[a.getMonth()]}`;
  const ib = `${b.getDate()} ${MESES[b.getMonth()]}`;
  return `${ia} – ${ib}`;
}

// "26 oct"
export function fechaCorta(s) {
  const d = parseFecha(s);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

// "Lunes 26"
export function etiquetaDia(s) {
  const d = parseFecha(s);
  return `${capital(DIAS[d.getDay()])} ${d.getDate()}`;
}

// "lunes 26"
export function etiquetaDiaMin(s) {
  const d = parseFecha(s);
  return `${DIAS[d.getDay()]} ${d.getDate()}`;
}

export function nombreDia(s) {
  return DIAS[parseFecha(s).getDay()];
}

// "el martes y el domingo"
export function listaDias(dias, articulo = 'el') {
  const partes = dias.map((d) => `${articulo} ${d}`);
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}
