// Navegación con almohadilla (#/semana, #/plato/<id>…): funciona en GitHub Pages sin servidor.
import { useEffect, useState } from 'react';

// Pila de pantallas visitadas dentro de la app, para saber si «volver» puede ir hacia atrás
const pila = [window.location.hash];
let reemplazando = false;

window.addEventListener('hashchange', () => {
  const h = window.location.hash;
  if (reemplazando) {
    reemplazando = false;
    pila[pila.length - 1] = h;
    return;
  }
  if (pila.length > 1 && pila[pila.length - 2] === h) pila.pop();
  else pila.push(h);
});

export function leerRuta() {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (/^(access_token|error|type|refresh_token)=/.test(h)) return { nombre: 'semana', id: null, extra: null };
  const partes = h.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  return { nombre: partes[0] || 'semana', id: partes[1] || null, extra: partes[2] || null };
}

export function useRuta() {
  const [ruta, setRuta] = useState(leerRuta);
  useEffect(() => {
    const cambiar = () => setRuta(leerRuta());
    window.addEventListener('hashchange', cambiar);
    return () => window.removeEventListener('hashchange', cambiar);
  }, []);
  return ruta;
}

export function ir(destino, { reemplazar = false } = {}) {
  const h = `#/${destino.replace(/^[#/]+/, '')}`;
  if (h === window.location.hash) return;
  if (reemplazar) {
    reemplazando = true;
    history.replaceState(null, '', h);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = h;
  }
  window.scrollTo(0, 0);
}

// Vuelve atrás si venimos de dentro de la app; si no, va a la pantalla indicada
export function volver(alternativa = 'semana') {
  if (pila.length > 1) history.back();
  else ir(alternativa, { reemplazar: true });
}
