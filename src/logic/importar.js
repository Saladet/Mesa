// Convierte una receta leída de una web (ver supabase/functions/leer-receta) en una receta de Mesa:
// ingredientes con cantidad, unidad y, si se reconoce, su ingrediente del catálogo (para la lista de la
// compra y las restricciones), pasos con temporizador y tipo de plato.
import { normalizar, GRUPOS } from './reglas.js';

const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'con', 'para', 'a', 'al', 'un', 'una', 'unos', 'unas', 'sin', 'por', 'su', 'sus', 'gusto', 'opcional', 'aprox', 'aproximadamente', 'cantidad', 'necesaria']);

// "tomates" -> "tomate", "limones" -> "limon", "dientes" -> "diente" (vale para comparar, no para escribir)
function singular(p) {
  if (p.length > 4 && p.endsWith('es') && /[nrldz]$/.test(p.slice(0, -2))) return p.slice(0, -2);
  if (p.length > 3 && p.endsWith('s')) return p.slice(0, -1);
  return p;
}

export function fichas(t) {
  return normalizar(t)
    .split(' ')
    .filter((x) => x && !VACIAS.has(x) && !/^\d/.test(x))
    .map(singular);
}

// Nombres con los que se escriben los ingredientes del catálogo en las webs
const ALIAS = {
  'aceite-oliva': ['aceite', 'aove'],
  ajo: ['diente ajo', 'ajo'],
  'picada-ternera': ['carne picada', 'picada ternera', 'carne picada ternera'],
  'picada-pavo': ['carne picada pavo', 'picada pavo'],
  'tomate-triturado': ['tomate triturado', 'tomate frito', 'salsa tomate'],
  'lentejas-pardinas': ['lenteja'],
  'garbanzos-cocidos': ['garbanzo cocido', 'bote garbanzo', 'garbanzo bote', 'garbanzo conserva'],
  'garbanzos-secos': ['garbanzo seco'],
  'alubias-blancas': ['alubia blanca', 'judia blanca'],
  'alubias-rojas': ['alubia roja', 'judia roja', 'frijol rojo'],
  'huesos-caldo': ['hueso'],
  huevos: ['huevo', 'yema', 'clara'],
  nata: ['nata', 'crema leche'],
  'caldo-pollo': ['caldo pollo', 'caldo ave'],
  'caldo-verduras': ['caldo verdura', 'caldo vegetal'],
  'caldo-carne': ['caldo carne'],
  'vino-blanco': ['vino blanco', 'jerez', 'vino fino'],
  limon: ['limon', 'zumo limon'],
  'pechuga-pollo': ['pechuga pollo'],
  'contramuslos-pollo': ['contramuslo'],
  'muslos-pollo': ['muslo pollo', 'jamoncito'],
  'pollo-troceado': ['pollo troceado', 'pollo entero', 'pollo'],
  'filete-ternera': ['filete ternera', 'ternera'],
  azafran: ['azafran', 'colorante'],
  'pimiento-verde': ['pimiento verde', 'pimiento italiano'],
  'judias-verdes': ['judia verde'],
  champinones: ['champinon'],
  setas: ['seta'],
  espinacas: ['espinaca'],
  guisantes: ['guisante'],
  'laminas-lasana': ['lamina lasana', 'placa lasana', 'pasta lasana'],
  'placas-canelones': ['canelon', 'placa canelon'],
  'pasta-integral': ['pasta', 'macarron', 'espiral', 'penne'],
  espaguetis: ['espagueti', 'spaghetti'],
  'arroz-redondo': ['arroz', 'arroz bomba'],
  cuscus: ['cuscus', 'couscous'],
  'yogur-natural': ['yogur'],
  'queso-fresco': ['queso fresco', 'requeson', 'ricotta'],
  mozzarella: ['mozzarella', 'mozarela'],
  'tomate-cherry': ['tomate cherry', 'tomatito'],
  cebolleta: ['cebolleta', 'cebolla tierna'],
  'nuez-moscada': ['nuez moscada'],
  'salsa-soja': ['salsa soja', 'soja'],
  avena: ['avena', 'copo avena'],
  calamar: ['calamar', 'chipiron', 'sepia'],
  'caldo-pescado': ['caldo pescado', 'fumet'],
  bacon: ['bacon', 'beicon', 'panceta'],
  'jamon-serrano': ['jamon', 'taco jamon'],
  'lomo-cerdo': ['lomo cerdo', 'lomo'],
  sal: ['sal', 'sal gorda'],
};

// Ingredientes que no se compran
const NO_SE_COMPRA = new Set(['agua', 'hielo', 'agua caliente', 'agua fria']);

// Índice del catálogo: para cada ingrediente, las listas de palabras con las que se reconoce
export function indiceCatalogo(ingredientes) {
  const claves = [];
  for (const ing of ingredientes) {
    const variantes = new Set([ing.id.replace(/-/g, ' '), String(ing.nombre || '').replace(/\(.*?\)/g, ''), ...(ALIAS[ing.id] || [])]);
    for (const v of variantes) {
      const f = fichas(v);
      if (f.length) claves.push({ id: ing.id, f });
    }
  }
  return { claves, porId: new Map(ingredientes.map((i) => [i.id, i])) };
}

// El ingrediente del catálogo que mejor encaja con un nombre ("pechugas de pollo" -> pechuga-pollo)
export function reconocer(nombre, indice) {
  const f = fichas(nombre);
  if (!f.length) return null;
  let mejor = null;
  for (const c of indice.claves) {
    if (!c.f.every((x) => f.includes(x))) continue;
    const pos = f.indexOf(c.f[0]);
    if (!mejor || c.f.length > mejor.f.length || (c.f.length === mejor.f.length && pos < mejor.pos)) mejor = { ...c, pos };
  }
  return mejor ? { id: mejor.id, cabeza: mejor.f[0] } : null;
}

const NUMEROS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, medio: 0.5, media: 0.5 };
const UNIDADES = [
  [/^(kg|kgs|kilo|kilos|kilogramos?)$/, 'g', 1000],
  [/^(g|gr|grs|gramos?)$/, 'g', 1],
  [/^(l|lt|lts|litros?)$/, 'ml', 1000],
  [/^(dl|decilitros?)$/, 'ml', 100],
  [/^(cl|centilitros?)$/, 'ml', 10],
  [/^(ml|mililitros?)$/, 'ml', 1],
  [/^(cucharadas?|cda|cdas)$/, 'cda', 1],
  [/^(cucharaditas?|cdta|cdtas|cdita|cditas)$/, 'cdta', 1],
  [/^(dientes?)$/, 'diente', 1],
  [/^(pizcas?|pellizcos?)$/, 'pizca', 1],
  [/^(latas?)$/, 'lata', 1],
  [/^(botes?|tarros?)$/, 'bote', 1],
  [/^(tarrinas?)$/, 'tarrina', 1],
  [/^(paquetes?|sobres?|bolsas?)$/, 'paquete', 1],
  [/^(manojos?)$/, 'manojo', 1],
  [/^(ramas?|ramitas?|ramilletes?)$/, 'rama', 1],
  [/^(hojas?)$/, 'hoja', 1],
  [/^(rebanadas?)$/, 'rebanada', 1],
  [/^(vasos?)$/, 'vaso', 1],
  [/^(tazas?)$/, 'taza', 1],
  [/^(unidad|unidades|ud|uds|piezas?)$/, 'ud', 1],
  [/^(chorros?|chorritos?|punados?|chorreones?|c\/s|cs)$/, null, 0],
];

function numero(t) {
  const s = t.replace(',', '.');
  if (/^\d+\s+\d+\/\d+$/.test(s)) {
    const [e, f] = s.split(/\s+/);
    const [a, b] = f.split('/');
    return Number(e) + Number(a) / Number(b);
  }
  if (/^\d+\/\d+$/.test(s)) {
    const [a, b] = s.split('/');
    return Number(b) ? Number(a) / Number(b) : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function unidadDe(palabra) {
  const p = normalizar(palabra).replace(/\s+/g, '');
  for (const [re, unidad, factor] of UNIDADES) if (re.test(p) || re.test(palabra.toLowerCase())) return { unidad, factor };
  return null;
}

const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * "300g Garbanzos", "2 cucharadas de aceite de oliva", "Media cebolla", "Sal (al gusto)", "Garbanzos cocidos 400 g"
 * -> { cantidad, unidad, nombre }
 */
export function leerIngrediente(texto) {
  let s = String(texto || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d)\s*½/g, '$1.5')
    .replace(/½/g, '0.5')
    .replace(/¼/g, '0.25')
    .replace(/¾/g, '0.75')
    .replace(/⅓/g, '0.33')
    .replace(/⅔/g, '0.67');
  const alGusto = /al gusto|c\/s|cantidad (suficiente|necesaria)|a gusto/i.test(s);
  let cantidad = null;
  let unidad = null;
  let resto = s;

  // Cantidad delante: "2-3", "1 1/2", "0.5", "1/2", "300g", "un", "media"…
  let m = resto.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*(?:-|a)\s*(\d+(?:[.,]\d+)?))?\s*(?:y\s+(medio|media)\b)?\s*(.*)$/i);
  if (m) {
    cantidad = numero(m[2] || m[1]);
    if (m[3]) cantidad += 0.5;
    resto = m[4];
  } else {
    m = resto.match(/^(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|medio|media)\b\s*(.*)$/i);
    if (m) {
      cantidad = NUMEROS[m[1].toLowerCase()];
      resto = m[2];
    }
  }
  if (cantidad != null) {
    // Unidad pegada o separada: "300g Garbanzos", "2 cucharadas de…"
    const u = resto.match(/^([a-záéíóúñ/]+)\.?\s*(.*)$/i);
    if (u) {
      const encontrada = unidadDe(u[1]);
      if (encontrada) {
        unidad = encontrada.unidad;
        cantidad = encontrada.unidad ? cantidad * encontrada.factor : null;
        resto = u[2].replace(/^(soperas?|de postre|rasas?|colmadas?|grandes?|pequeñas?|medianas?)\b\s*/i, '');
      }
    }
    resto = resto.replace(/^(de|del)\s+/i, '');
  } else {
    // Cantidad detrás: "Garbanzos cocidos 400 g", "Cebolla 1"
    const t = resto.match(/^(.*?\D)\s+(\d+(?:[.,]\d+)?)\s*([a-záéíóú]+)?\.?$/i);
    if (t) {
      const encontrada = t[3] ? unidadDe(t[3]) : null;
      if (!t[3] || encontrada) {
        cantidad = numero(t[2]);
        unidad = encontrada ? encontrada.unidad : null;
        if (encontrada?.unidad) cantidad *= encontrada.factor;
        else if (encontrada) cantidad = null;
        resto = t[1];
      }
    }
  }
  const nombre = resto
    .replace(/\(\s*(al gusto|opcional)\s*\)/gi, '')
    .replace(/\s*(,\s*)?(al gusto|a gusto|c\/s)\s*$/i, '')
    .replace(/[.,;:\s]+$/, '')
    .trim();
  if (alGusto && cantidad == null) unidad = 'al_gusto';
  if (cantidad == null) unidad = 'al_gusto';
  else if (!unidad) unidad = 'ud';
  return { cantidad: cantidad != null ? Math.round(cantidad * 100) / 100 : null, unidad, nombre: capital(nombre) };
}

// Minutos que se mencionan en un paso ("cocinar 3-4 minutos", "unos 20 minutos", "1 hora y media")
export function minutosDePaso(texto) {
  const s = normalizar(texto);
  const PAL = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, noventa: 90 };
  const candidatos = [];
  const add = (pos, min) => min > 0 && candidatos.push({ pos, min });
  for (const m of s.matchAll(/\b(\d+)\s*(?:-|a|o)\s*(\d+)\s*(minutos?|min)\b/g)) add(m.index, Number(m[2]));
  for (const m of s.matchAll(/\b(\d+)\s*(minutos?|min)\b/g)) add(m.index, Number(m[1]));
  for (const m of s.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(horas?|h)\b( y media)?/g)) add(m.index, Number(m[1].replace(',', '.')) * 60 + (m[3] ? 30 : 0));
  for (const m of s.matchAll(/\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|noventa)\s+(minutos|horas?)\b( y media)?/g)) {
    add(m.index, PAL[m[1]] * (m[2].startsWith('hora') ? 60 : 1) + (m[3] ? 30 : 0));
  }
  for (const m of s.matchAll(/\bmedia hora\b/g)) add(m.index, 30);
  for (const m of s.matchAll(/\bcuarto de hora\b/g)) add(m.index, 15);
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => a.pos - b.pos || b.min - a.min);
  const min = Math.round(candidatos[0].min);
  return min > 0 && min <= 240 ? min : null;
}

const PALETAS = [
  { base: '#D9A23F', d1: '#F2E8D5', d2: '#6E9B3B', bg: '#F6EAD2' },
  { base: '#C9452F', d1: '#F2CF5B', d2: '#4E7A33', bg: '#F6E3DC' },
  { base: '#6E9B3B', d1: '#F2E8D5', d2: '#E9843B', bg: '#E7EEDD' },
  { base: '#E9843B', d1: '#E3C27A', d2: '#4E7A33', bg: '#F6EAD2' },
  { base: '#8B5A3C', d1: '#E9843B', d2: '#F2E8D5', bg: '#EFE6DA' },
  { base: '#E8D9B5', d1: '#8C6A4F', d2: '#6E9B3B', bg: '#F2EEDD' },
  { base: '#F2CF5B', d1: '#E9C46A', d2: '#C9452F', bg: '#F6EFD9' },
  { base: '#5B3A5E', d1: '#E2C08D', d2: '#C9452F', bg: '#EEE6EE' },
];

function contiene(t, palabras) {
  const s = ` ${normalizar(t)} `;
  return palabras.some((p) => s.includes(` ${p}`));
}

const NO_ES_COMIDA = ['postre', 'tarta', 'bizcocho', 'galleta', 'flan ', 'natillas', 'helado', 'mousse', 'brownie', 'magdalena', 'muffin', 'cupcake', 'tiramisu', 'pudin', 'pudding', 'arroz con leche', 'torrija', 'rosquilla', 'churro', 'bollo', 'cheesecake', 'mermelada', 'compota', 'batido', 'zumo', 'coctel', 'sangria', 'licor', 'bebida'];
const DESAYUNO = ['desayuno', 'tostada', 'porridge', 'gachas', 'tortitas', 'pancake', 'granola', 'overnight', 'smoothie', 'muesli'];
const LEGUMBRE = ['lenteja', 'garbanzo', 'alubia', 'judion', 'fabada', 'fabes', 'frijol', 'hummus', 'falafel', 'dal ', 'habas', 'potaje', 'puchero', 'olla gitana'];
const HUEVO = ['tortilla de', 'tortilla espanola', 'revuelto', 'frittata', 'quiche', 'shakshuka', 'huevo', 'huevos'];
const CAPRICHO = ['pizza', 'hamburguesa', 'burger', 'nachos', 'croqueta', 'kebab', 'perrito', 'hot dog', 'frito ', 'fritos', 'rebozado'];

/**
 * Receta leída de la web -> { receta, ingredientes, sinCatalogo, llevaPescado }
 * datos: { titulo, foto, tiempo, raciones, ingredientes: [texto], pasos: [texto], categoria, palabras }
 */
export function recetaDesdeWeb(datos, { hogarId, url, ingredientes: catalogo }) {
  const indice = indiceCatalogo(catalogo);
  const filas = [];
  const cabezas = new Map(); // ingrediente_id -> palabra con la que se busca en los pasos
  for (const linea of datos.ingredientes || []) {
    const { cantidad, unidad, nombre } = leerIngrediente(linea);
    if (!nombre || NO_SE_COMPRA.has(normalizar(nombre))) continue;
    const r = reconocer(nombre, indice);
    let u = unidad;
    if (r?.id === 'ajo' && u === 'ud') u = 'diente';
    const previa = r ? filas.find((f) => f.ingrediente_id === r.id && f.unidad === u) : null;
    if (previa) {
      if (previa.cantidad != null && cantidad != null) previa.cantidad = Math.round((previa.cantidad + cantidad) * 100) / 100;
      continue;
    }
    if (r && u === 'al_gusto' && filas.some((f) => f.ingrediente_id === r.id)) continue;
    filas.push({ ingrediente_id: r ? r.id : null, texto_original: nombre.slice(0, 120), cantidad, unidad: u });
    if (r) cabezas.set(r.id, r.cabeza);
  }

  const pasos = (datos.pasos || []).map((texto) => {
    const f = new Set(fichas(texto));
    const ids = [...cabezas].filter(([, cabeza]) => f.has(cabeza)).map(([id]) => id);
    return { texto: texto.slice(0, 700), min: minutosDePaso(texto), ingredientes: ids };
  });

  const titulo = datos.titulo.slice(0, 120);
  const pista = `${titulo} ${datos.categoria || ''}`;
  let momentos = ['comida', 'cena'];
  if (contiene(pista, NO_ES_COMIDA) || /^(salsa|pan|masa|alino|vinagreta)\b/i.test(normalizar(titulo))) momentos = ['postre'];
  else if (contiene(pista, DESAYUNO)) momentos = ['desayuno'];

  const grupos = (fila) => (fila.ingrediente_id ? indice.porId.get(fila.ingrediente_id)?.grupos || [] : []);
  const textoFilas = filas.map((f) => f.texto_original).join(' · ');
  const llevaPescado =
    filas.some((f) => grupos(f).includes('pescado')) || contiene(`${titulo} ${textoFilas}`, GRUPOS.pescado.palabras);
  let proteina = 'otro';
  if (contiene(titulo, GRUPOS.pescado.palabras)) proteina = 'pescado';
  else if ((contiene(titulo, LEGUMBRE) || /^cocido\b/.test(normalizar(titulo))) && !contiene(titulo, ['judia verde', 'judias verdes'])) proteina = 'legumbre';
  else if (contiene(titulo, HUEVO) && !contiene(titulo, ['tortillas de trigo', 'tortillas de maiz'])) proteina = 'huevo';
  else if (contiene(titulo, GRUPOS.carne.palabras)) proteina = 'carne';
  else if (llevaPescado) proteina = 'pescado';
  else if (filas.some((f) => grupos(f).includes('legumbre') || (!f.ingrediente_id && contiene(f.texto_original, GRUPOS.legumbre.palabras)))) proteina = 'legumbre';
  else if (filas.some((f) => grupos(f).includes('carne') && !/^(caldo|huesos)/.test(f.ingrediente_id))) proteina = 'carne';
  else if (filas.some((f) => f.ingrediente_id === 'huevos' && (f.cantidad || 0) >= 3)) proteina = 'huevo';
  else if (filas.some((f) => grupos(f).includes('lacteo') && f.unidad !== 'al_gusto')) proteina = 'lacteo';

  let hash = 0;
  for (const ch of titulo) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  return {
    receta: {
      hogar_id: hogarId,
      titulo,
      origen: 'importada',
      url_origen: url,
      foto_url: datos.foto || null,
      tiempo_min: datos.tiempo || null,
      raciones: datos.raciones || 4,
      pasos,
      paleta: PALETAS[hash % PALETAS.length],
      momentos,
      proteina,
      capricho: contiene(titulo, CAPRICHO),
      etiquetas: ['auto'],
    },
    ingredientes: filas,
    sinCatalogo: filas.filter((f) => !f.ingrediente_id && f.unidad !== 'al_gusto').length,
    llevaPescado,
  };
}

// Dos enlaces a la misma receta (con o sin www, barra final, parámetros de campaña…)
export function mismaUrl(a, b) {
  const limpia = (u) => {
    try {
      const x = new URL(u);
      return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch {
      return String(u || '').toLowerCase();
    }
  };
  return !!a && !!b && limpia(a) === limpia(b);
}
