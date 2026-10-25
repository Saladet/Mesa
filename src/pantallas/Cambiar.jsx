import { useEffect, useMemo, useState } from 'react';
import { useDatos } from '../datos.jsx';
import Icono from '../ui/Icono.jsx';
import Portada from '../ui/Portada.jsx';
import { tiempo, origen, minuscula } from '../ui/textos.jsx';
import { etiquetaDia } from '../logic/fechas.js';
import { NOMBRE_TIPO } from '../logic/semanas.js';
import { alternativas } from '../logic/generar.js';
import { formatoMedia } from '../logic/valoraciones.js';
import { volver } from '../ruta.js';

const MOTIVOS = [
  ['apetece', 'No me apetece'],
  ['largo', 'Es largo'],
  ['falta', 'Falta algo en casa'],
  ['proteina', 'Otra proteína'],
];
const POR_PAGINA = 3;

export default function Cambiar({ comidaId }) {
  const d = useDatos();
  const comida = d.comidas.find((c) => c.id === comidaId);
  const menu = comida ? d.menus.find((m) => m.id === comida.menu_id) : null;
  const actual = comida ? d.recetasMap.get(comida.receta_id) : null;
  const [motivos, setMotivos] = useState(() => new Set(['apetece']));
  const [pagina, setPagina] = useState(0);
  const [elegida, setElegida] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [semilla] = useState(() => Math.floor(Math.random() * 1e6));

  const cerrar = () => volver('semana');

  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
    };
  }, []);

  const opciones = useMemo(() => {
    if (!comida || !menu) return [];
    const comidasMenu = d.comidas.filter((c) => c.menu_id === menu.id);
    // Lo que ya se compra para el resto de platos de la semana
    const enLista = new Set();
    for (const c of comidasMenu) {
      if (c.id === comida.id) continue;
      const r = d.recetasMap.get(c.receta_id);
      for (const ri of r?.receta_ingredientes || []) if (ri.ingrediente_id) enLista.add(ri.ingrediente_id);
    }
    return alternativas({
      inicio: menu.semana_inicio,
      fecha: comida.fecha,
      tipo: comida.tipo,
      actual,
      comidasMenu,
      recetas: d.recetas,
      recetasMap: d.recetasMap,
      ingMap: d.ingMap,
      restricciones: d.restricciones,
      reglas: d.hogar?.reglas,
      motivos,
      enLista,
      medias: d.medias,
      semilla,
    });
  }, [comida, menu, actual, d.comidas, d.recetas, d.recetasMap, d.ingMap, d.restricciones, d.hogar, d.medias, motivos, semilla]);

  const paginas = Math.max(1, Math.ceil(opciones.length / POR_PAGINA));
  const visibles = opciones.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);
  const seleccion = visibles.find((o) => o.receta.id === elegida) ? elegida : visibles[0]?.receta.id ?? null;

  useEffect(() => setPagina(0), [motivos]);

  if (!comida) {
    return (
      <>
        <div className="velo" onClick={cerrar} />
        <section className="hoja" role="dialog" aria-modal="true" aria-label="Cambiar plato">
          <span className="tirador" />
          <div className="vacio-suave">Este hueco ya no existe.</div>
          <button className="boton" type="button" onClick={cerrar}>
            Volver
          </button>
        </section>
      </>
    );
  }

  function alternar(m) {
    setMotivos((prev) => {
      const s = new Set(prev);
      if (s.has(m)) s.delete(m);
      else s.add(m);
      if (!s.size) s.add('apetece');
      return s;
    });
  }

  async function aplicar(recetaId) {
    setGuardando(true);
    const ok = await d.acciones.cambiarComida(comida, recetaId);
    setGuardando(false);
    if (ok) {
      d.avisar(recetaId ? 'Cambiado. La lista ya está al día.' : 'Hueco libre. La lista ya está al día.');
      cerrar();
    }
  }

  const tipoTexto = NOMBRE_TIPO[comida.tipo].toLowerCase();

  return (
    <>
      <div className="velo" onClick={cerrar} />
      <section className="hoja" role="dialog" aria-modal="true" aria-labelledby="titulo-cambiar">
        <span className="tirador" aria-hidden="true" />
        <div className="hoja-cab">
          <div className="cab-textos">
            <span className="momento" style={{ fontSize: 13 }}>
              {etiquetaDia(comida.fecha)}
              {actual ? ` · ${minuscula(actual.titulo)}` : ' · sin plato'}
            </span>
            <h1 id="titulo-cambiar" className="hoja-titulo">
              {actual ? `Cambiar la ${tipoTexto}` : `Elegir la ${tipoTexto}`}
            </h1>
          </div>
          <button className="boton-cerrar" type="button" onClick={cerrar} aria-label="Cerrar">
            <Icono n="cerrar" t={18} />
          </button>
        </div>

        {actual ? (
          <fieldset className="grupo">
            <legend>¿Qué no os convence?</legend>
            <div className="chips-sel">
              {MOTIVOS.map(([id, texto]) => (
                <label key={id} className="chip">
                  <input type="checkbox" checked={motivos.has(id)} onChange={() => alternar(id)} />
                  <span>{texto}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="grupo">
          <legend>Alternativas que encajan en la semana</legend>
          {visibles.length ? (
            <div className="opciones">
              {visibles.map(({ receta, razon }) => (
                <label key={receta.id} className="opcion">
                  <input type="radio" name="alternativa" checked={seleccion === receta.id} onChange={() => setElegida(receta.id)} />
                  <Portada receta={receta} forma="mini" />
                  <span className="opcion-textos">
                    <span className="opcion-titulo">{receta.titulo}</span>
                    <span className="meta">
                      {[tiempo(receta.tiempo_min), origen(receta, d.notas.has(receta.id)), d.medias.has(receta.id) ? `★ ${formatoMedia(d.medias.get(receta.id))}` : null, razon]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="vacio-suave">
              No hay más platos que encajen con estas condiciones. Quita alguna o pídele a Claude recetas nuevas para el recetario.
            </div>
          )}
        </fieldset>

        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          {paginas > 1 ? (
            <button className="boton borde" type="button" onClick={() => setPagina((pagina + 1) % paginas)}>
              {pagina + 1 < paginas ? `Ver otras ${Math.min(POR_PAGINA, opciones.length - (pagina + 1) * POR_PAGINA)}` : 'Ver las primeras'}
            </button>
          ) : null}
          <button className="boton flex" type="button" disabled={!seleccion || guardando} onClick={() => aplicar(seleccion)}>
            {guardando ? 'Cambiando…' : actual ? 'Cambiar' : 'Elegir'}
          </button>
        </div>
        {actual ? (
          <button className="boton-texto gris" type="button" disabled={guardando} onClick={() => aplicar(null)} style={{ alignSelf: 'center' }}>
            Ese día no cocináis: dejar el hueco libre
          </button>
        ) : null}
      </section>
    </>
  );
}
