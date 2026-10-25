import { useState } from 'react';
import { useDatos } from '../datos.jsx';
import Icono from '../ui/Icono.jsx';
import Portada from '../ui/Portada.jsx';
import { tiempo, veces, dominio } from '../ui/textos.jsx';
import { normalizar, conflictosReceta, esBloqueante } from '../logic/reglas.js';
import { mensajeError } from '../supabase.js';
import { formatoMedia } from '../logic/valoraciones.js';

const memoria = { filtro: 'todas' };

// Cada filtro recibe la receta y su resumen de notas (si lo hay)
const FILTROS = [
  ['todas', 'Todas', () => true],
  ['favoritas', 'Favoritas', (r, nota) => nota?.media != null && nota.media >= 4],
  ['rapidas', 'Rápidas', (r) => (r.tiempo_min || 99) <= 20],
  ['legumbre', 'Legumbre', (r) => r.proteina === 'legumbre'],
  ['carne', 'Carne', (r) => r.proteina === 'carne'],
  ['huevo', 'Huevo', (r) => r.proteina === 'huevo'],
  ['vegetal', 'Vegetal', (r) => r.proteina === 'lacteo' || r.proteina === 'otro'],
  ['caprichos', 'Caprichos', (r) => r.capricho],
  ['probadas', 'Probadas', (r, nota) => r.veces_cocinada > 0 || !!nota],
  ['desayunos', 'Desayunos', (r) => (r.momentos || []).includes('desayuno')],
];

function metaFicha(r, nota) {
  const partes = [];
  if (nota?.media != null) partes.push(`★ ${formatoMedia(nota.media)}`);
  if (r.veces_cocinada > 0) partes.push(`Hecha ${veces(r.veces_cocinada)}`);
  else if (nota) partes.push('Probada');
  else if (r.origen === 'importada') partes.push('Importada');
  else if (r.origen === 'vuestra') partes.push('Vuestra');
  else partes.push('Nueva · sin probar');
  if (r.tiempo_min) partes.push(tiempo(r.tiempo_min));
  return partes.join(' · ');
}

export default function Recetas() {
  const d = useDatos();
  const [filtro, setFiltro] = useState(memoria.filtro);
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [enlace, setEnlace] = useState('');
  const [guardando, setGuardando] = useState(false);

  const regla = FILTROS.find((f) => f[0] === filtro) || FILTROS[0];
  const q = normalizar(busqueda);
  const hayDesayunos = d.recetas.some((r) => (r.momentos || []).includes('desayuno'));
  const visibles = d.recetas
    .filter((r) => regla[2](r, d.notas.get(r.id)))
    .filter((r) => filtro === 'desayunos' || !((r.momentos || []).length === 1 && r.momentos[0] === 'desayuno'))
    .filter((r) => !q || normalizar(r.titulo).includes(q) || (r.receta_ingredientes || []).some((ri) => normalizar(ri.texto_original).includes(q)))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));

  async function importar(e) {
    e.preventDefault();
    let url = enlace.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      d.avisar('Eso no parece un enlace.', 'error');
      return;
    }
    setGuardando(true);
    try {
      await d.acciones.importarEnlace(url);
      setEnlace('');
      d.avisar('Guardado. Pídele a Claude que importe las recetas pendientes de Mesa.');
    } catch (err) {
      d.avisar(mensajeError(err), 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="app con-tabs">
      <section className="cabecera compacta">
        <header className="cab-fila">
          <h1 className="cab-titulo medio">Recetas</h1>
          <button
            type="button"
            className="boton-redondo-oscuro"
            aria-label={buscando ? 'Cerrar búsqueda' : 'Buscar recetas'}
            aria-expanded={buscando}
            onClick={() => {
              setBuscando(!buscando);
              setBusqueda('');
            }}
          >
            <Icono n={buscando ? 'cerrar' : 'buscar'} />
          </button>
        </header>
        {buscando ? (
          <div className="importar">
            <label htmlFor="buscar">Buscar por nombre o ingrediente</label>
            <input id="buscar" className="campo oscuro" type="search" autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Garbanzos, pollo, crema…" />
          </div>
        ) : (
          <form className="importar" onSubmit={importar}>
            <label htmlFor="enlace-receta">Importar de una web</label>
            <div className="fila">
              <input
                id="enlace-receta"
                className="campo oscuro"
                type="url"
                inputMode="url"
                autoCapitalize="none"
                placeholder="Pega el enlace de la receta"
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
              />
              <button className="boton lima" type="submit" disabled={!enlace.trim() || guardando || !d.enLinea}>
                {guardando ? '…' : 'Importar'}
              </button>
            </div>
          </form>
        )}
      </section>

      <main className="cuerpo cerca" style={{ gap: 16 }}>
        {d.importaciones.length ? (
          <div className="pendientes">
            <strong>
              {d.importaciones.length === 1 ? '1 receta pendiente de importar' : `${d.importaciones.length} recetas pendientes de importar`}
            </strong>
            {d.importaciones.slice(0, 3).map((imp) => (
              <span key={imp.id} className="url">
                {dominio(imp.url)} · {imp.url}
              </span>
            ))}
            <span className="nota-gris">Dile a Claude «importa las recetas pendientes de Mesa» y aparecerán aquí con sus fotos.</span>
          </div>
        ) : null}

        <div className="filtros" role="group" aria-label="Filtrar recetas">
          {FILTROS.filter((f) => f[0] !== 'desayunos' || hayDesayunos).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={`chip peq${filtro === id ? ' on' : ''}`}
              aria-pressed={filtro === id}
              onClick={() => {
                setFiltro(id);
                memoria.filtro = id;
              }}
            >
              {texto}
            </button>
          ))}
        </div>

        {visibles.length ? (
          <div className="rejilla-recetas">
            {visibles.map((r) => {
              const noApta = conflictosReceta(r, d.restricciones, d.ingMap).some(esBloqueante);
              return (
                <a key={r.id} className="ficha" href={`#/receta/${r.id}`}>
                  <Portada receta={r} forma="rejilla" />
                  <span className="ficha-titulo">{r.titulo}</span>
                  <span className="ficha-meta">{noApta ? 'No apta para todos' : metaFicha(r, d.notas.get(r.id))}</span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="vacio-suave">{q ? 'No hay recetas con eso.' : 'No hay recetas en este grupo todavía.'}</div>
        )}
        <p className="nota-gris" style={{ margin: 0 }}>
          {d.recetas.length} recetas en el recetario. ¿Queréis más? Pedídselas a Claude y aparecerán aquí.
        </p>
      </main>
    </div>
  );
}
