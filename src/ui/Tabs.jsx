import Icono from './Icono.jsx';

const PESTANAS = [
  ['semana', 'Semana'],
  ['lista', 'Lista'],
  ['recetas', 'Recetas'],
  ['hogar', 'Hogar'],
];

export default function Tabs({ actual, pendientes = 0 }) {
  return (
    <nav className="tabs" aria-label="Secciones">
      {PESTANAS.map(([id, texto]) => (
        <a key={id} href={`#/${id}`} className={`tab${actual === id ? ' on' : ''}`} aria-current={actual === id ? 'page' : undefined}>
          <Icono n={id} />
          <span>{texto}</span>
          {id === 'lista' && pendientes > 0 ? <span className="globo" aria-label={`${pendientes} por comprar`}>{pendientes}</span> : null}
        </a>
      ))}
    </nav>
  );
}
