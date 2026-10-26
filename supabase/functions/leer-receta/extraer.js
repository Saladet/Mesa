// Saca la receta de una página web a partir de sus datos estructurados (schema.org/Recipe en JSON-LD),
// que publican casi todas las webs de cocina para Google. JavaScript puro: lo usa la función de
// Supabase (Deno) y también las pruebas en Node.

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', ntilde: 'ñ', Ntilde: 'Ñ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', uuml: 'ü', Uuml: 'Ü', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

function decodificar(t) {
  return String(t)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+\d*);/gi, (m, e) => (ENTIDADES[e] != null ? ENTIDADES[e] : m));
}

// Texto limpio: sin etiquetas HTML, con las negritas como **texto** y sin espacios de sobra
function limpiar(t, { parrafos = false } = {}) {
  if (t == null) return '';
  let s = decodificar(String(t));
  s = s.replace(/<\s*(strong|b)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_, __, x) => `**${x.trim()}**`);
  if (parrafos) s = s.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\s*\/\s*(p|li|div|h\d)\s*>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodificar(s); // por si venían entidades dobles
  s = s.replace(/([a-záéíóúñ)])\.([A-ZÁÉÍÓÚÑ¿¡])/g, '$1. $2'); // «verduras.Recuerda» -> «verduras. Recuerda»
  if (parrafos) {
    return s
      .split(/\n/)
      .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return s.replace(/\s+/g, ' ').trim();
}

function texto(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(texto).filter(Boolean).join(', ');
  if (typeof v === 'object') return texto(v.name || v.text || v['@value'] || '');
  return limpiar(v);
}

function parsearJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    try {
      // Saltos de línea o tabuladores sin escapar dentro de los textos
      return JSON.parse(t.replace(/[\u0000-\u001f]+/g, ' '));
    } catch {
      return null;
    }
  }
}

function esReceta(o) {
  const t = o && o['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

function buscarReceta(o, prof = 0) {
  if (!o || typeof o !== 'object' || prof > 8) return null;
  if (Array.isArray(o)) {
    for (const x of o) {
      const r = buscarReceta(x, prof + 1);
      if (r) return r;
    }
    return null;
  }
  if (esReceta(o) && o.recipeIngredient) return o;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'hasPart']) {
    if (o[k] && typeof o[k] === 'object') {
      const r = buscarReceta(o[k], prof + 1);
      if (r) return r;
    }
  }
  return null;
}

// "PT1H30M", "P0DT0H30M" -> minutos
export function minutosISO(v) {
  if (!v || typeof v !== 'string') return 0;
  const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return 0;
  return Math.round(Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0) + Number(m[4] || 0) / 60);
}

function raciones(v) {
  const valores = Array.isArray(v) ? v : [v];
  for (const x of valores) {
    const n = typeof x === 'number' ? x : Number((String(x ?? '').match(/\d+/) || [])[0]);
    if (Number.isFinite(n) && n >= 1 && n <= 30) return Math.round(n);
  }
  return null;
}

function imagen(v) {
  let url = null;
  if (typeof v === 'string') url = v;
  else if (Array.isArray(v)) {
    for (const x of v) {
      url = imagen(x);
      if (url) break;
    }
  } else if (v && typeof v === 'object') url = v.url || v.contentUrl || v['@id'] || null;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  // Las fotos de Weblogs (Directo al Paladar) se piden en formato apaisado
  return url.replace(/^(https?:\/\/i\.blogs\.es\/[^/]+\/[^/]+\/)\d+_\d+(\.\w+)$/i, '$1840_560$2');
}

const TITULARES = /^(receta|recetas|consejos?|trucos?|ingredientes|paso a paso|c[oó]mo (hacer|preparar)|elaboraci[oó]n|preparaci[oó]n|presentaci[oó]n|notas?|v[ií]deo)\b/i;

// Quita los titulillos que algunas webs meten como pasos («Consejos para…», «Receta de…»)
function esTitular(p) {
  const palabras = p.split(/\s+/).length;
  if (/[.!?:)]$/.test(p) || palabras > 8) return false;
  return TITULARES.test(p) || /\bpara \d+ personas\b/i.test(p);
}

// Una línea de ingredientes metida entre los pasos («3 huevos medianos», «Sal (al gusto)»)
function pareceIngrediente(p) {
  if (p.length > 70 || /[.!?]$/.test(p)) return false;
  return /^(\d+([.,]\d+)?|½|¼|¾|media|medio|una?|dos|tres|cuatro|cinco|seis)\s+\S/i.test(p) || /\(al gusto\)|\bal gusto$/i.test(p);
}

function partirLargo(p) {
  if (p.length <= 600) return [p];
  const frases = p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [p];
  const out = [];
  let actual = '';
  for (const f of frases) {
    if ((actual + f).length > 420 && actual) {
      out.push(actual.trim());
      actual = '';
    }
    actual += f;
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}

function pasos(v) {
  const out = [];
  const meter = (t) => {
    const s = limpiar(t, { parrafos: true });
    if (!s) return;
    for (const trozo of s.split(/\n\s*\n/)) {
      const p = trozo.replace(/\s*\n\s*/g, ' ').trim();
      if (p) out.push(...partirLargo(p));
    }
  };
  const recorrer = (x) => {
    if (x == null) return;
    if (typeof x === 'string') return meter(x);
    if (Array.isArray(x)) return x.forEach(recorrer);
    if (typeof x === 'object') {
      if (x.itemListElement) return recorrer(x.itemListElement);
      if (x.text) return meter(x.text);
      if (x.name) return meter(x.name);
      if (x.description) return meter(x.description);
    }
    return undefined;
  };
  recorrer(v);
  // Algunas webs añaden, detrás de los pasos, otra lista de ingredientes y sus consejos: se corta ahí
  const corte = out.findIndex((p, i) => i >= 2 && pareceIngrediente(p) && pareceIngrediente(out[i + 1] || ''));
  const utiles = corte === -1 ? out : out.slice(0, corte);
  const vistos = new Set();
  return utiles
    .map((p) => p.replace(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?: [a-záéíóúñ]+){0,3}) (?=[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñ])/, '$1: '))
    .filter((p) => {
      if (p.length < 3 || esTitular(p) || (p.length <= 40 && /\(al gusto\)|\bal gusto$/i.test(p)) || vistos.has(p)) return false;
      vistos.add(p);
      return true;
    });
}

function limpiarTitulo(t) {
  let s = texto(t)
    .replace(/^receta(s)?\s*(de|:)\s*/i, '')
    .replace(/\s*[|·–—-]\s*(cookpad|recetasgratis|directo al paladar|bon viveur|hogarmania|de rechupete).*$/i, '')
    // «Pollo tikka masala, la receta de pollo al curry más popular…» -> «Pollo tikka masala»
    .replace(/\s*[,:;.–—-]\s*(la |una |mi |nuestra |esta )?receta\b.*$/i, '')
    .trim();
  if (s.length > 70 && s.includes('. ')) s = s.slice(0, s.indexOf('. '));
  s = s.replace(/[.\s]+$/, '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Devuelve { titulo, foto, tiempo, raciones, ingredientes: [texto], pasos: [texto], categoria, palabras }
 * o null si la página no trae una receta legible.
 */
export function extraerReceta(html) {
  const bloques = [...String(html).matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]);
  for (const b of bloques) {
    const r = buscarReceta(parsearJson(b.trim()));
    if (!r) continue;
    const ingredientes = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : [r.recipeIngredient])
      .map((x) => texto(x))
      .filter(Boolean)
      .slice(0, 40);
    const titulo = limpiarTitulo(r.name || r.headline);
    if (!titulo || !ingredientes.length) continue;
    const total = minutosISO(r.totalTime) || minutosISO(r.prepTime) + minutosISO(r.cookTime);
    return {
      titulo,
      foto: imagen(r.image),
      tiempo: total > 0 && total < 24 * 60 ? total : null,
      raciones: raciones(r.recipeYield),
      ingredientes,
      pasos: pasos(r.recipeInstructions).slice(0, 30),
      categoria: texto(r.recipeCategory),
      palabras: texto(r.keywords).slice(0, 300),
    };
  }
  return null;
}
