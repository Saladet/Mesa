// Convierte lo que se escribe ("la remolacha, ni verla") en una restricción estructurada.
import { GRUPOS, normalizar } from './reglas.js';

const RELLENO = new Set(
  ('el la los las lo un una unos unas de del al a y o ni nada no nunca jamas me te le les se nos gusta gustan gusto ' +
    'come comer comemos comen como toma tomo toman verla verlo verlas verlos ver odio odia odiamos mejor poco poca ' +
    'pocos pocas muy mucho mucha tambien solo sin con en que porque por favor alergia alergias alergico alergica ' +
    'alergicos intolerancia intolerante es son ser soy sea estar esta estan nunca casi tolera tolero vez veces')
    .split(' ')
);

const SINONIMOS = [
  ['frutos secos', 'frutos_secos'],
  ['carne roja', 'carne_roja'],
  ['pescados', 'pescado'],
  ['pescado', 'pescado'],
  ['mariscos', 'marisco'],
  ['marisco', 'marisco'],
  ['carnes', 'carne'],
  ['carne', 'carne'],
  ['cerdo', 'cerdo'],
  ['lacteos', 'lacteo'],
  ['lacteo', 'lacteo'],
  ['lactosa', 'lacteo'],
  ['gluten', 'gluten'],
  ['celiaco', 'gluten'],
  ['celiaca', 'gluten'],
  ['picantes', 'picante'],
  ['picante', 'picante'],
  ['setas', 'setas'],
  ['hongos', 'setas'],
  ['legumbres', 'legumbre'],
  ['soja', 'soja'],
  ['huevos', 'huevo'],
  ['huevo', 'huevo'],
];

function formas(palabra) {
  return new Set([palabra, palabra.replace(/s$/, ''), palabra.replace(/es$/, '')]);
}

function iguales(a, b) {
  const fa = formas(a);
  for (const f of formas(b)) if (fa.has(f)) return true;
  return false;
}

function puntuar(frase, nombre) {
  const fp = frase.split(' ');
  const np = nombre.split(' ');
  if (frase === nombre) return 5;
  if (fp.length === np.length && fp.every((w, i) => iguales(w, np[i]))) return 4;
  if (fp.length < np.length && fp.every((w, i) => iguales(w, np[i]))) return 3;
  if (fp.length === 1 && np.some((w) => iguales(w, fp[0]))) return 2;
  return 0;
}

export function slug(t) {
  return normalizar(t).replace(/ /g, '-');
}

export function interpretar(texto, ingredientes) {
  const original = (texto || '').trim();
  if (!original) return null;
  const n = normalizar(original);

  let nivel = 'no_come';
  if (/alergi|intoleran|celiac/.test(n)) nivel = 'alergia';
  else if (/\bpoco\b|\bpoca\b|a veces|de vez en cuando|no mucho|no demasiado|en salsa|tolera/.test(n)) nivel = 'mejor_poco';

  const trozos = original.split(/[,;.]/).map((s) => s.trim()).filter(Boolean);
  const principal = trozos[0] || original;
  let nota = null;
  for (const t of trozos.slice(1)) {
    const tn = normalizar(t);
    if (/\bsi\b|\bsolo\b|\bmenos\b|\bpero\b/.test(tn)) nota = t.replace(/^pero\s+/i, '');
  }

  const pn = ` ${normalizar(principal)} `;
  for (const [palabra, grupo] of SINONIMOS) {
    if (pn.includes(` ${palabra} `)) {
      return { tipo: 'grupo', valor: grupo, nombre: GRUPOS[grupo].nombre, nivel, nota };
    }
  }

  const utiles = principal
    .split(/\s+/)
    .filter((w) => w && !RELLENO.has(normalizar(w)));
  const frase = normalizar(utiles.join(' '));
  if (!frase) return null;

  let mejor = null;
  let mejorP = 0;
  for (const ing of ingredientes) {
    const p = puntuar(frase, normalizar(ing.nombre));
    if (p > mejorP) { mejor = ing; mejorP = p; }
  }
  if (mejor && mejorP >= 2) {
    return { tipo: 'ingrediente', valor: mejor.id, nombre: mejor.nombre, nivel, nota };
  }
  const nombre = utiles.join(' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();
  return {
    tipo: 'ingrediente',
    valor: slug(nombre),
    nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
    nivel,
    nota,
    nuevo: true,
  };
}
