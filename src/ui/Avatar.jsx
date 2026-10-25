export default function Avatar({ persona, tam = 34, borde, fuente }) {
  if (!persona) return null;
  const letra = (persona.nombre || '?').trim().charAt(0) || '?';
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: tam,
        height: tam,
        background: persona.color || '#E3EAE5',
        border: borde ? `2px solid ${borde}` : undefined,
        fontSize: fuente || Math.round(tam * 0.38),
      }}
    >
      {letra}
    </span>
  );
}

export function Avatares({ personas, tam = 34, borde }) {
  return (
    <span className="avatares">
      {personas.map((p) => (
        <Avatar key={p.id} persona={p} tam={tam} borde={borde} />
      ))}
      <span className="sr">Compartida entre {personas.map((p) => p.nombre).join(' y ')}</span>
    </span>
  );
}
