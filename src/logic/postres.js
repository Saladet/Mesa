// El postre de la semana: una tanda que se hace un día y dura varios.
import { diasEntre, sumarDias } from './fechas.js';

// Días que se come la tanda después de hacerla (por eso se cocina para comensales × DIAS_POSTRE)
export const DIAS_POSTRE = 4;

// Etiquetas de azúcar de los postres revisados. Solo estos salen solos en el menú.
export const AZUCAR = {
  'sin-azucar': 'Sin azúcar añadido',
  'poco-azucar': 'Poco azúcar',
};

export function esPostre(receta) {
  return !!receta && (receta.momentos || []).includes('postre');
}

export function nivelAzucar(receta) {
  return (receta?.etiquetas || []).find((e) => AZUCAR[e]) || null;
}

export function textoAzucar(receta) {
  const n = nivelAzucar(receta);
  return n ? AZUCAR[n] : null;
}

// Raciones que se cocinan: un plato es para los que comen; un postre, para varios días
export function racionesPara(receta, comensales) {
  return esPostre(receta) ? comensales * DIAS_POSTRE : comensales;
}

// Por cuánto se multiplican las cantidades de la receta
export function factorRaciones(receta, comensales) {
  return racionesPara(receta, comensales) / (receta?.raciones || (esPostre(receta) ? 8 : 2));
}

// "Tanda para 4 días" / "Para 2"
export function textoRaciones(receta, comensales) {
  return esPostre(receta) ? `Tanda para ${DIAS_POSTRE} días` : `Para ${comensales}`;
}

// Día en que se acaba la tanda hecha en `fecha`
export function finDelPostre(fecha) {
  return sumarDias(fecha, DIAS_POSTRE);
}

// El postre hecho en los días anteriores a `fecha` que todavía queda (el más reciente), o null
export function postreQueQueda({ comidas, recetasMap, fecha }) {
  let mejor = null;
  for (const c of comidas) {
    if (c.tipo !== 'postre' || !c.receta_id || c.fecha >= fecha || diasEntre(c.fecha, fecha) > DIAS_POSTRE) continue;
    if (!mejor || c.fecha > mejor.fecha) mejor = c;
  }
  const receta = mejor ? recetasMap.get(mejor.receta_id) : null;
  return receta ? { comida: mejor, receta, hasta: finDelPostre(mejor.fecha) } : null;
}
