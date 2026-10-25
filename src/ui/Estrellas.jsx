import { ETIQUETAS, formatoMedia } from '../logic/valoraciones.js';

const CAMINO = 'M12 3.2l2.62 5.46 5.98.82-4.36 4.15 1.07 5.94L12 16.7l-5.31 2.87 1.07-5.94L3.4 9.48l5.98-.82z';

export function Estrella({ llena, t = 18 }) {
  return (
    <svg className={`estrella${llena ? ' llena' : ''}`} viewBox="0 0 24 24" width={t} height={t} aria-hidden="true">
      <path d={CAMINO} />
    </svg>
  );
}

// Solo para leer: ★★★★☆
export function Puntuacion({ valor, t = 14 }) {
  return (
    <span className="puntuacion" role="img" aria-label={`${valor} de 5: ${ETIQUETAS[valor]}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Estrella key={i} llena={i <= valor} t={t} />
      ))}
    </span>
  );
}

// Para puntuar: cinco estrellas grandes
export function ElegirEstrellas({ valor = 0, alCambiar, t = 34, deshabilitado = false, etiqueta = 'Puntuación' }) {
  return (
    <div className="elegir-estrellas" role="group" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-pressed={valor === i}
          aria-label={`${i} de 5: ${ETIQUETAS[i]}`}
          disabled={deshabilitado}
          onClick={() => alCambiar(i)}
        >
          <Estrella llena={valor >= i} t={t} />
        </button>
      ))}
    </div>
  );
}

// "★ 4,5" (nota media)
export function Media({ media, t = 13 }) {
  if (media == null) return null;
  return (
    <span className="media" aria-label={`Nota media ${formatoMedia(media)} de 5`}>
      <Estrella llena t={t} />
      <span aria-hidden="true">{formatoMedia(media)}</span>
    </span>
  );
}
