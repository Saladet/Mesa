import { useState } from 'react';
import Icono from './Icono.jsx';

// El plato dibujado (cuando todavía no hay foto). Dos versiones: grande (con sombra) y pequeña.
export function Dibujo({ paleta, tam, grande }) {
  const p = paleta || { base: '#E9EDE9', d1: '#C9D3CC', d2: '#B9C8BE' };
  if (grande) {
    return (
      <svg viewBox="0 0 120 120" width={tam} height={tam} aria-hidden="true">
        <circle cx="62" cy="64" r="56" fill="rgba(70,45,20,0.10)" />
        <circle cx="60" cy="60" r="56" fill="#FFFFFF" />
        <circle cx="60" cy="60" r="42" fill={p.base} />
        <circle cx="48" cy="48" r="4.5" fill={p.d1} />
        <circle cx="71" cy="58" r="4.5" fill={p.d1} />
        <circle cx="57" cy="74" r="4.5" fill={p.d1} />
        <circle cx="68" cy="42" r="3.5" fill={p.d1} />
        <circle cx="52" cy="62" r="3" fill={p.d2} />
        <circle cx="75" cy="72" r="3" fill={p.d2} />
        <circle cx="42" cy="66" r="3" fill={p.d2} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" width={tam} height={tam} aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#FFFFFF" />
      <circle cx="60" cy="60" r="42" fill={p.base} />
      <circle cx="48" cy="48" r="5" fill={p.d1} />
      <circle cx="71" cy="58" r="5" fill={p.d1} />
      <circle cx="57" cy="74" r="5" fill={p.d1} />
      <circle cx="52" cy="62" r="3.5" fill={p.d2} />
      <circle cx="75" cy="72" r="3.5" fill={p.d2} />
    </svg>
  );
}

const FORMAS = {
  tarjeta: { tam: 144, grande: true, icono: 24, texto: 'Pendiente de estrenar' },
  hero: { tam: 190, grande: true, icono: 28, texto: 'Sin foto todavía' },
  fila: { tam: 60, grande: false, icono: 22 },
  mini: { tam: 46, grande: false, icono: 18 },
  rejilla: { tam: 88, grande: false, icono: 22 },
  casilla: { tam: 56, grande: false, icono: 18 },
};

// Fotos que no cargan (enlace roto o web que no deja enseñarlas): se recuerdan para no reintentar
const rotas = new Set();

export default function Portada({ receta, forma = 'tarjeta' }) {
  const f = FORMAS[forma];
  const [, refrescar] = useState(0);
  const foto = receta?.foto_url && !rotas.has(receta.foto_url) ? receta.foto_url : null;
  if (foto) {
    return (
      <span className={`portada ${forma}`} style={{ position: 'relative', background: receta.paleta?.bg }}>
        <img
          src={foto}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            rotas.add(foto);
            refrescar((n) => n + 1);
          }}
        />
      </span>
    );
  }
  if (receta?.paleta) {
    return (
      <span className={`portada ${forma}`} style={{ background: receta.paleta.bg }} aria-hidden="true">
        <Dibujo paleta={receta.paleta} tam={f.tam} grande={f.grande} />
      </span>
    );
  }
  return (
    <span className={`portada ${forma} sin`} aria-hidden="true">
      <Icono n="camara" t={f.icono} />
      {f.texto ? <span>{f.texto}</span> : null}
    </span>
  );
}
