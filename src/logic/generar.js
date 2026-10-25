// Propuesta de menú semanal y alternativas para cambiar un plato.
import { conflictosReceta, esBloqueante, contarSemana, reglasCompletas } from './reglas.js';
import { sumarDias, diaSemana, diasEntre } from './fechas.js';

export const TIPOS = ['desayuno', 'comida', 'cena'];

// Días que aguanta lo más perecedero de la receta (99 si todo es de despensa)
export function frescura(receta, ingMap) {
  let min = 99;
  for (const ri of receta.receta_ingredientes || []) {
    const ing = ri.ingrediente_id ? ingMap.get(ri.ingrediente_id) : null;
    if (!ing || ing.dias_nevera == null || (ing.grupos || []).includes('basico')) continue;
    if ((ing.grupos || []).includes('carne')) continue; // la carne se puede congelar
    if (ing.dias_nevera < min) min = ing.dias_nevera;
  }
  return min;
}

// Primer día de la próxima semana.
// Si no queda nada planificado desde hoy, empieza hoy. Si no, el siguiente día de compra
// después del inicio de la última semana (si se solapa con ella, la última se acorta).
export function siguienteInicio(menus, diaCompra, hoy, ultimoDia) {
  if (!menus.length || !ultimoDia || ultimoDia < hoy) return hoy;
  const ultimo = menus.reduce((a, b) => (a.semana_inicio > b.semana_inicio ? a : b));
  let f = sumarDias(ultimo.semana_inicio, 1);
  if (f < hoy) f = hoy;
  for (let i = 0; i < 7 && diaSemana(f) !== diaCompra; i++) f = sumarDias(f, 1);
  return f;
}

function azarCon(semilla) {
  let s = 0;
  for (const ch of String(semilla)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Devuelve [{ fecha, tipo, receta_id }] para 7 días desde `inicio`.
 * Rellena hueco a hueco con algo de azar (para que las semanas cambien), respetando las reglas,
 * poniendo lo que caduca antes al principio y buscando una semana equilibrada.
 */
export function generarSemana({ inicio, recetas, ingMap, restricciones, reglas, momentos, recientes = new Set(), intentos = 60, semilla = Date.now() }) {
  const azar = azarCon(semilla);
  const r = reglasCompletas(reglas);
  const tipos = TIPOS.filter((t) => momentos.includes(t));
  const permitidas = [];
  const blandas = new Map();
  for (const receta of recetas) {
    const conf = conflictosReceta(receta, restricciones, ingMap);
    if (conf.some(esBloqueante)) continue;
    permitidas.push(receta);
    blandas.set(receta.id, conf.length);
  }
  const fres = new Map(permitidas.map((x) => [x.id, frescura(x, ingMap)]));
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
  const finde = dias.map((f, i) => ({ f, i })).filter(({ f }) => [5, 6, 0].includes(diaSemana(f))).map(({ i }) => i);
  const caprichos = permitidas.filter((x) => x.capricho);
  const principales = tipos.filter((t) => t !== 'desayuno');
  const totalHuecos = 7 * principales.length;
  // Lo que se busca en una semana normal (sin pasarse de los máximos)
  const objetivo = {
    legumbre: Math.max(r.legumbre_min, Math.min(r.legumbre_min + 1, totalHuecos)),
    carne: r.carne_max,
    huevo: Math.min(r.huevos_max, 3),
  };

  const validas = [];
  let mejor = null;
  for (let k = 0; k < intentos; k++) {
    const res = intentar();
    if (!mejor || res.puntos > mejor.puntos) mejor = res;
    if (res.valida) {
      validas.push(res);
      if (validas.length >= 6) break;
    }
  }
  if (validas.length) {
    validas.sort((a, b) => b.puntos - a.puntos);
    return validas[Math.floor(azar() * Math.min(3, validas.length))].slots;
  }
  return mejor ? mejor.slots : [];

  function intentar() {
    const cuenta = { legumbre: 0, carne: 0, huevo: 0, capricho: 0, pescado: 0 };
    const usadas = new Set();
    const slots = [];
    let puntos = 0;
    let vacios = 0;
    let hechos = 0;

    let capricho = null;
    if (r.caprichos_max > 0 && caprichos.length && finde.length && azar() < 0.9) {
      const d = finde[Math.floor(azar() * finde.length)];
      const t = principales.includes('cena') && azar() < 0.75 ? 'cena' : principales.includes('comida') ? 'comida' : principales[0];
      const cands = caprichos.filter((x) => (x.momentos || []).includes(t) && !(x.proteina === 'carne' && r.carne_max < 1));
      if (cands.length) {
        capricho = { d, t, receta: cands[Math.floor(azar() * cands.length)] };
        cuenta.capricho += 1;
        if (cuenta[capricho.receta.proteina] != null) cuenta[capricho.receta.proteina] += 1;
        usadas.add(capricho.receta.id);
      }
    }

    let desayunoAyer = null;
    for (let d = 0; d < 7; d++) {
      const delDia = [];
      for (const t of tipos) {
        if (t !== 'desayuno') hechos += 1;
        if (capricho && capricho.d === d && capricho.t === t) {
          slots.push({ fecha: dias[d], tipo: t, receta_id: capricho.receta.id });
          delDia.push(capricho.receta.proteina);
          continue;
        }
        const quedan = totalHuecos - hechos + 1; // huecos principales que faltan, contando este
        const faltaLegumbre = r.legumbre_min - cuenta.legumbre;
        let elegida = null;
        let mejorP = -Infinity;
        for (const x of permitidas) {
          if (x.capricho || !(x.momentos || []).includes(t)) continue;
          if (t !== 'desayuno' && usadas.has(x.id)) continue;
          if (x.proteina === 'carne' && cuenta.carne >= r.carne_max) continue;
          if (x.proteina === 'huevo' && cuenta.huevo >= r.huevos_max) continue;
          let p = azar() * 4;
          if (t === 'desayuno') {
            if (x.id === desayunoAyer) p -= 3;
          } else {
            if (x.proteina === 'legumbre' && faltaLegumbre > 0 && faltaLegumbre >= quedan - 1) p += 8;
            if (objetivo[x.proteina] != null) p += cuenta[x.proteina] < objetivo[x.proteina] ? 1.2 : -2.5;
            if (recientes.has(x.id)) p -= 2.5;
            p -= 2 * (blandas.get(x.id) || 0);
            if (delDia.includes(x.proteina) && ['huevo', 'carne'].includes(x.proteina)) p -= 3;
            else if (delDia.includes(x.proteina)) p -= 1;
            const f = fres.get(x.id);
            if (f <= 3) p += d <= 1 ? 1 : d === 2 ? 0 : -4;
            else if (f <= 5) p += d <= 3 ? 0.3 : -2;
            if (x.proteina === 'carne' && d <= 1) p += 0.4;
            if ((x.veces_cocinada || 0) > 0) p += 0.3;
          }
          if (p > mejorP) {
            mejorP = p;
            elegida = x;
          }
        }
        if (!elegida) {
          slots.push({ fecha: dias[d], tipo: t, receta_id: null });
          if (t !== 'desayuno') vacios += 1;
          puntos -= 10;
          continue;
        }
        puntos += mejorP;
        slots.push({ fecha: dias[d], tipo: t, receta_id: elegida.id });
        if (t === 'desayuno') {
          desayunoAyer = elegida.id;
        } else {
          usadas.add(elegida.id);
          if (cuenta[elegida.proteina] != null) cuenta[elegida.proteina] += 1;
          delDia.push(elegida.proteina);
        }
      }
    }
    const valida = !vacios && cuenta.legumbre >= r.legumbre_min;
    if (cuenta.legumbre < r.legumbre_min) puntos -= 20 * (r.legumbre_min - cuenta.legumbre);
    return { slots, puntos, valida };
  }
}

/**
 * Alternativas para un hueco del menú, de mejor a peor.
 * motivos: Set con 'apetece' | 'largo' | 'falta' | 'proteina'
 */
export function alternativas({ inicio, fecha, tipo, actual, comidasMenu, recetas, recetasMap, ingMap, restricciones, reglas, motivos, enLista, semilla = 1 }) {
  const r = reglasCompletas(reglas);
  const azar = azarCon(semilla);
  const jitter = new Map(recetas.map((x) => [x.id, azar()]));
  const otras = comidasMenu
    .filter((c) => !(c.fecha === fecha && c.tipo === tipo) && c.tipo !== 'desayuno')
    .map((c) => recetasMap.get(c.receta_id))
    .filter(Boolean);
  const enSemana = new Set(otras.map((x) => x.id));
  const base = contarSemana(otras);
  const desfase = diasEntre(inicio, fecha);
  const out = [];
  for (const x of recetas) {
    if (actual && x.id === actual.id) continue;
    if (!(x.momentos || []).includes(tipo)) continue;
    if (tipo !== 'desayuno' && enSemana.has(x.id)) continue;
    const conf = conflictosReceta(x, restricciones, ingMap);
    if (conf.some(esBloqueante)) continue;
    let rompe = null;
    if (tipo !== 'desayuno') {
      const c = { ...base };
      if (c[x.proteina] != null) c[x.proteina] += 1;
      if (x.capricho) c.capricho += 1;
      if (c.carne > r.carne_max || c.huevo > r.huevos_max || c.capricho > r.caprichos_max) continue;
      if (c.legumbre < r.legumbre_min) rompe = 'legumbre';
    }
    if (motivos.has('largo')) {
      const limite = Math.min(actual?.tiempo_min ?? 999, 30);
      if ((x.tiempo_min ?? 99) > limite) continue;
    }
    if (motivos.has('proteina') && actual && x.proteina === actual.proteina) continue;

    const propios = (x.receta_ingredientes || []).filter((ri) => {
      const ing = ri.ingrediente_id ? ingMap.get(ri.ingrediente_id) : null;
      return !(ing && (ing.grupos || []).includes('basico'));
    });
    const yaEstan = propios.filter((ri) => ri.ingrediente_id && enLista.has(ri.ingrediente_id)).length;
    const nuevos = propios.length - yaEstan;
    const parte = propios.length ? yaEstan / propios.length : 0;

    let p = jitter.get(x.id) * 1.2;
    p += parte * (motivos.has('falta') ? 5 : 1.5);
    if (rompe) p -= 3;
    p -= 2 * conf.length;
    if ((x.veces_cocinada || 0) > 0) p += 0.7;
    const f = frescura(x, ingMap);
    if (f < 99 && desfase > f) p -= 2;
    if (motivos.has('largo')) p += (30 - (x.tiempo_min ?? 30)) / 15;

    let razon = null;
    if (rompe) razon = 'Os quedaríais cortos de legumbre';
    else if (nuevos === 0) razon = 'No hay que comprar nada más';
    else if (nuevos === 1) razon = 'Solo hay que comprar 1 cosa';
    else if (nuevos <= 3) razon = `Solo hay que comprar ${nuevos} cosas`;
    else if (f < 99 && desfase > f) razon = 'Lleva algo que aguanta poco';
    out.push({ receta: x, puntos: p, razon, conflictos: conf });
  }
  return out.sort((a, b) => b.puntos - a.puntos);
}
