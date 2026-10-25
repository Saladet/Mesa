// Qué semana se ve y para qué semana se compra.
import { sumarDias } from './fechas.js';

export function ordenarMenus(menus) {
  return [...menus].sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));
}

export function diasDelMenu(menu, comidas) {
  if (!menu) return [];
  const dias = [...new Set(comidas.filter((c) => c.menu_id === menu.id).map((c) => c.fecha))].sort();
  return dias.length ? dias : Array.from({ length: 7 }, (_, i) => sumarDias(menu.semana_inicio, i));
}

export function finDelMenu(menu, comidas) {
  const dias = diasDelMenu(menu, comidas);
  return dias[dias.length - 1];
}

// La semana que incluye hoy; si no hay, la próxima; si no, la última
export function menuDeHoy(menus, comidas, hoy) {
  const orden = ordenarMenus(menus);
  let actual = null;
  for (const m of orden) if (m.semana_inicio <= hoy && finDelMenu(m, comidas) >= hoy) actual = m;
  if (actual) return actual;
  return orden.find((m) => m.semana_inicio > hoy) || orden[orden.length - 1] || null;
}

// Semanas cuya lista aún sirve (no han terminado), de la más antigua a la más nueva
export function menusVivos(menus, comidas, hoy) {
  return ordenarMenus(menus).filter((m) => finDelMenu(m, comidas) >= hoy);
}

// La lista que se enseña por defecto: la de la última semana planificada que no ha terminado
export function menuDeCompra(menus, comidas, hoy) {
  const vivos = menusVivos(menus, comidas, hoy);
  if (vivos.length) return vivos[vivos.length - 1];
  const orden = ordenarMenus(menus);
  return orden[orden.length - 1] || null;
}

export const TIPOS_ORDEN = { desayuno: 0, comida: 1, cena: 2 };
export const NOMBRE_TIPO = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena' };
