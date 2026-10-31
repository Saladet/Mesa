// Colores de la app. Cada casa elige los suyos (hogares.tema) y el móvil los recuerda,
// para que la pantalla de entrada y la de carga salgan ya con ellos.
const CLAVE_TEMA = 'mesa-tema';

export const TEMA_INICIAL = 'huerta';

export const TEMAS = {
  huerta: {
    nombre: 'Huerta',
    descripcion: 'Verde y lima',
    color: '#1D3B2F', // barra del móvil
    marca: { base: '#C9EE6B', d1: '#1D3B2F', d2: '#E9843B' },
  },
  mar: {
    nombre: 'Mar',
    descripcion: 'Azul y albaricoque',
    color: '#18364F',
    marca: { base: '#FFC48A', d1: '#18364F', d2: '#E0603F' },
  },
};

function valido(id) {
  return Object.prototype.hasOwnProperty.call(TEMAS, id) ? id : TEMA_INICIAL;
}

export function temaGuardado() {
  try {
    return valido(localStorage.getItem(CLAVE_TEMA));
  } catch {
    return TEMA_INICIAL;
  }
}

// Al abrir: el del enlace de invitación (…#/unirse/<token>?tema=mar) o el último usado en este móvil
export function temaAlAbrir() {
  const consulta = window.location.hash.split('?')[1] || '';
  const delEnlace = new URLSearchParams(consulta).get('tema');
  return delEnlace && TEMAS[delEnlace] ? delEnlace : temaGuardado();
}

export function aplicarTema(id) {
  const tema = valido(id);
  const raiz = document.documentElement;
  if (tema === TEMA_INICIAL) delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;
  const sufijo = tema === TEMA_INICIAL ? '' : `-${tema}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', TEMAS[tema].color);
  // Icono y colores al añadir la app a la pantalla de inicio
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', `manifest${sufijo}.webmanifest`);
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', `icons/apple-touch-icon${sufijo}.png`);
  document.querySelector('link[rel="icon"]')?.setAttribute('href', `icons/favicon${sufijo}.svg`);
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    /* sin almacenamiento: se aplica igual */
  }
  return tema;
}

export function marcaDe(id) {
  return TEMAS[valido(id)].marca;
}
