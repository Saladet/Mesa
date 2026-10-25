// Puntuaciones (1-5) y comentarios de cada vez que coméis un plato.
import { sumarDias, nombreDia, etiquetaDia, fechaCorta, diasEntre } from './fechas.js';
import { TIPOS_ORDEN, NOMBRE_TIPO } from './semanas.js';

export const ETIQUETAS = { 1: 'No lo repetimos', 2: 'Flojillo', 3: 'Normal', 4: 'Muy rico', 5: 'Espectacular' };

// Frases rápidas para no tener que escribir
export const ATAJOS = ['Para repetir', 'Le faltó sal', 'Le faltó sabor', 'Sobró comida', 'Nos quedamos con hambre', 'Tardó más de lo que pone'];

// Por debajo de esta media, el plato deja de salir solo en las semanas
export const MEDIA_MINIMA = 2;

const clave = (v) => `${v.receta_id}|${v.persona_id}|${v.fecha}`;

// Mete (o sustituye) una valoración en la lista, sin duplicar la misma persona, plato y día
export function ponerValoracion(lista, fila) {
  const k = clave(fila);
  return [fila, ...lista.filter((v) => v.id !== fila.id && clave(v) !== k)];
}

export function quitarValoracion(lista, fila) {
  const k = clave(fila);
  return lista.filter((v) => v.id !== fila.id && clave(v) !== k);
}

export function buscarValoracion(lista, recetaId, personaId, fecha) {
  return lista.find((v) => v.receta_id === recetaId && v.persona_id === personaId && v.fecha === fecha) || null;
}

// receta_id → { media, n (puntuaciones), total (notas), ultima (fecha) }
export function resumenNotas(valoraciones) {
  const m = new Map();
  for (const v of valoraciones) {
    let r = m.get(v.receta_id);
    if (!r) {
      r = { suma: 0, n: 0, total: 0, ultima: null, media: null };
      m.set(v.receta_id, r);
    }
    r.total += 1;
    if (v.puntuacion) {
      r.suma += v.puntuacion;
      r.n += 1;
    }
    if (!r.ultima || v.fecha > r.ultima) r.ultima = v.fecha;
  }
  for (const r of m.values()) r.media = r.n ? r.suma / r.n : null;
  return m;
}

// receta_id → media (solo las que tienen puntuación)
export function mediasDe(resumen) {
  const out = new Map();
  for (const [id, r] of resumen) if (r.media != null) out.set(id, r.media);
  return out;
}

// "4,5"
export function formatoMedia(media) {
  if (media == null) return '';
  return (Math.round(media * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

// Notas de una receta agrupadas por día, de la más reciente a la más antigua
export function notasPorDia(valoraciones, recetaId, personas = []) {
  const orden = new Map(personas.map((p, i) => [p.id, i]));
  const dias = new Map();
  for (const v of valoraciones) {
    if (v.receta_id !== recetaId) continue;
    if (!dias.has(v.fecha)) dias.set(v.fecha, []);
    dias.get(v.fecha).push(v);
  }
  return [...dias.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([fecha, lista]) => ({ fecha, lista: lista.sort((a, b) => (orden.get(a.persona_id) ?? 99) - (orden.get(b.persona_id) ?? 99)) }));
}

// Los comentarios del último día que dejasteis alguno (antes de `antesDe`)
export function ultimosComentarios(valoraciones, recetaId, antesDe) {
  const con = valoraciones.filter((v) => v.receta_id === recetaId && v.comentario && (!antesDe || v.fecha < antesDe));
  if (!con.length) return [];
  const ultima = con.reduce((m, v) => (v.fecha > m ? v.fecha : m), con[0].fecha);
  return con.filter((v) => v.fecha === ultima);
}

// ¿Ya os lo habéis comido? La comida cuenta a partir de las 16:00 y la cena a partir de las 22:00.
export function yaComido(comida, hoy, hora) {
  if (comida.fecha < hoy) return true;
  if (comida.fecha > hoy) return false;
  if (comida.tipo === 'desayuno') return hora >= 11;
  if (comida.tipo === 'comida') return hora >= 16;
  return hora >= 22;
}

// El último plato de estos días que todavía no has valorado
export function pendienteDeValorar({ comidas, valoraciones, persona, hoy, hora, descartadas = new Set(), dias = 3 }) {
  if (!persona) return null;
  const desde = sumarDias(hoy, -dias);
  const hechas = new Set(valoraciones.filter((v) => v.persona_id === persona.id).map((v) => `${v.receta_id}|${v.fecha}`));
  const candidatas = comidas.filter(
    (c) =>
      c.receta_id &&
      c.tipo !== 'desayuno' &&
      c.fecha >= desde &&
      yaComido(c, hoy, hora) &&
      !hechas.has(`${c.receta_id}|${c.fecha}`) &&
      !descartadas.has(c.id),
  );
  candidatas.sort((a, b) => (a.fecha === b.fecha ? TIPOS_ORDEN[b.tipo] - TIPOS_ORDEN[a.tipo] : a.fecha < b.fecha ? 1 : -1));
  return candidatas[0] || null;
}

// "Cena de ayer", "Comida de hoy", "Comida del jueves"
export function cuandoFue(comida, hoy) {
  const tipo = NOMBRE_TIPO[comida.tipo] || 'Plato';
  const dias = diasEntre(comida.fecha, hoy);
  if (dias === 0) return `${tipo} de hoy`;
  if (dias === 1) return `${tipo} de ayer`;
  return `${tipo} del ${nombreDia(comida.fecha)}`;
}

// "Hoy", "Ayer", "Jueves 23", "12 oct"
export function cuandoFecha(fecha, hoy) {
  const dias = diasEntre(fecha, hoy);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias > 1 && dias < 7) return etiquetaDia(fecha);
  return fechaCorta(fecha);
}

// Añade o quita una frase rápida del comentario
export function alternarAtajo(texto, atajo) {
  const t = (texto || '').trim();
  const escapado = atajo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\s.,;])${escapado}[.!]?(?=$|[\\s.,;])`, 'i');
  if (re.test(t)) {
    return t
      .replace(re, '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s.,;]+/, '')
      .trim();
  }
  if (!t) return `${atajo}.`;
  return `${t}${/[.!?]$/.test(t) ? '' : '.'} ${atajo}.`;
}

export function tieneAtajo(texto, atajo) {
  const escapado = atajo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s.,;])${escapado}[.!]?(?=$|[\\s.,;])`, 'i').test(texto || '');
}
