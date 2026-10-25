// Pequeños formatos de texto compartidos por varias pantallas.

export function tiempo(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function veces(n) {
  return n === 1 ? '1 vez' : `${n} veces`;
}

export function origen(receta) {
  if (receta.origen === 'importada') return 'Importada';
  if (receta.origen === 'vuestra') return 'Vuestra';
  return receta.veces_cocinada > 0 ? 'Probada' : 'Nueva';
}

export function metaReceta(receta) {
  return [tiempo(receta.tiempo_min), origen(receta), receta.capricho ? 'capricho' : null].filter(Boolean).join(' · ');
}

export function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function minuscula(t) {
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

// "a, b y c"
export function enumerar(lista) {
  if (lista.length <= 1) return lista.join('');
  return `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

// Convierte **texto** en resaltado (negrita en la receta, marcador en modo cocina)
export function Resaltado({ texto, como = 'strong' }) {
  const partes = String(texto || '').split(/\*\*(.+?)\*\*/g);
  const Etiqueta = como;
  return partes.map((p, i) => (i % 2 === 1 ? <Etiqueta key={i}>{p}</Etiqueta> : p));
}
