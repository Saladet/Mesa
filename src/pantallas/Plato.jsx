import { useEffect, useRef, useState } from 'react';
import { useDatos } from '../datos.jsx';
import Icono from '../ui/Icono.jsx';
import Portada from '../ui/Portada.jsx';
import { Avatares } from '../ui/Avatar.jsx';
import { tiempo, veces, dominio, minuscula, Resaltado } from '../ui/textos.jsx';
import { etiquetaDiaMin, hoyISO } from '../logic/fechas.js';
import { ValorarComida, NotasAnteriores } from '../ui/Notas.jsx';
import { yaComido } from '../logic/valoraciones.js';
import { Media } from '../ui/Estrellas.jsx';
import { NOMBRE_TIPO } from '../logic/semanas.js';
import { conflictosReceta, esBloqueante, nombreRestriccion, PROTEINAS } from '../logic/reglas.js';
import { formatoCantidad, escalar } from '../logic/cantidades.js';
import { mensajeError } from '../supabase.js';
import { volver, ir } from '../ruta.js';

export function NoEncontrado({ texto = 'Este plato ya no está en el menú.' }) {
  return (
    <div className="app">
      <section className="cabecera compacta">
        <button className="boton-redondo-oscuro" type="button" onClick={() => volver('semana')} aria-label="Volver">
          <Icono n="atras" />
        </button>
        <h1 className="cab-titulo medio">No encontrado</h1>
      </section>
      <main className="cuerpo">
        <div className="vacio-suave">{texto}</div>
        <a className="boton" href="#/semana">
          Ir a la semana
        </a>
      </main>
    </div>
  );
}

export default function PantallaPlato({ comidaId, recetaId }) {
  const d = useDatos();
  const entrada = useRef(null);
  const [todos, setTodos] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const posicion = useRef({}); // dónde va la valoración: se decide al entrar y no se mueve
  const comida = comidaId ? d.comidas.find((c) => c.id === comidaId) : null;
  const receta = d.recetasMap.get(comida ? comida.receta_id : recetaId);
  const comentar = window.location.hash.includes('?comentar');

  // Al venir de «Añadir un comentario», se baja hasta la valoración
  useEffect(() => {
    if (comentar) document.getElementById('valorar')?.scrollIntoView({ block: 'start' });
  }, [comentar, comidaId]);

  if (!receta) return <NoEncontrado texto={comidaId ? 'Este plato ya no está en el menú.' : 'No encuentro esta receta.'} />;

  const factor = d.comensales / (receta.raciones || 2);
  const ingredientes = receta.receta_ingredientes || [];
  const visibles = todos ? ingredientes : ingredientes.slice(0, 5);
  const conflictos = conflictosReceta(receta, d.restricciones, d.ingMap);
  const etiqueta = comida ? `${NOMBRE_TIPO[comida.tipo]} · ${etiquetaDiaMin(comida.fecha)}` : 'Receta';

  const hoy = hoyISO();
  const nota = d.notas.get(receta.id);
  // Se valora el plato de un día ya comido, el que ya empezasteis a valorar (por ejemplo, al terminar de
  // cocinarlo antes de tiempo) o, fuera del menú, el que habéis valorado hoy
  const yaValorada = (f) => d.valoraciones.some((v) => v.receta_id === receta.id && v.fecha === f);
  let fechaValorar = null;
  if (comida) fechaValorar = comida.fecha <= hoy || yaValorada(comida.fecha) ? comida.fecha : null;
  else if (yaValorada(hoy)) fechaValorar = hoy;
  // Si es el plato de hoy y aún no lo habéis comido, la valoración va al final (para no estorbar al cocinar)
  const clavePosicion = `${comidaId || recetaId}|${fechaValorar}`;
  if (posicion.current[clavePosicion] === undefined) {
    posicion.current[clavePosicion] =
      !!fechaValorar && (!comida || comentar || yaValorada(fechaValorar) || yaComido(comida, hoy, new Date().getHours()));
  }
  const valorarArriba = posicion.current[clavePosicion];
  const valorar = fechaValorar ? <ValorarComida receta={receta} fecha={fechaValorar} abrirComentario={comentar} /> : null;

  let historia;
  if (receta.veces_cocinada > 0) historia = `La habéis hecho ${veces(receta.veces_cocinada)}.`;
  else if (nota) historia = 'Ya la habéis probado.';
  else if (receta.origen === 'importada') historia = 'Importada de una web; todavía no la habéis probado.';
  else if (receta.origen === 'vuestra') historia = 'Receta vuestra.';
  else historia = 'Receta nueva: todavía no la habéis probado.';

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setSubiendo(true);
    try {
      await d.acciones.subirFoto(receta, archivo);
      d.avisar('Foto guardada. Ya la veis los dos.');
    } catch (err) {
      console.error(err);
      d.avisar(mensajeError(err), 'error');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="plato app">
      <div className="plato-hero">
        <Portada receta={receta} forma="hero" />
        <button className="accion izq" type="button" onClick={() => volver(comida ? 'semana' : 'recetas')} aria-label="Volver">
          <Icono n="atras" />
        </button>
        <button
          className="accion der"
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo || !d.enLinea}
          aria-label={receta.foto_url ? 'Cambiar la foto' : 'Añadir una foto'}
        >
          {subiendo ? <span className="meta">…</span> : <Icono n="camara" />}
        </button>
        <input ref={entrada} type="file" accept="image/*" hidden onChange={elegirFoto} />
      </div>

      <main className="plato-cuerpo">
        <div className="cab-textos">
          <span className="momento" style={{ fontSize: 13 }}>
            {etiqueta}
          </span>
          <h1 className="plato-titulo">{receta.titulo}</h1>
        </div>

        <div className="pildoras">
          {receta.tiempo_min ? (
            <span className="pildora">
              <Icono n="reloj" t={14} />
              <span>{tiempo(receta.tiempo_min)}</span>
            </span>
          ) : null}
          <span className="pildora">Para {d.comensales}</span>
          {receta.proteina && PROTEINAS[receta.proteina] ? <span className="pildora">{PROTEINAS[receta.proteina]}</span> : null}
          {receta.capricho ? <span className="pildora lima">Capricho</span> : null}
        </div>

        <div className="franja">
          <Avatares personas={d.personas} tam={28} borde="#FFFFFF" />
          <span>
            {historia}
            {nota?.media != null ? (
              <>
                {' '}
                <Media media={nota.media} />
              </>
            ) : null}
            {receta.url_origen ? (
              <>
                {' '}
                <a className="enlace-origen" href={receta.url_origen} target="_blank" rel="noreferrer">
                  Ver en {dominio(receta.url_origen)}
                </a>
              </>
            ) : null}
          </span>
        </div>

        {conflictos.map((r) => (
          <span key={r.id} className="conflicto">
            <Icono n="aviso" t={14} />
            Lleva {minuscula(nombreRestriccion(r, d.ingMap))}:{' '}
            {esBloqueante(r)
              ? `${d.personasMap.get(r.persona_id)?.nombre} no ${r.nivel === 'alergia' ? 'puede tomarlo' : 'lo come'}`
              : `mejor poco para ${d.personasMap.get(r.persona_id)?.nombre}`}
          </span>
        ))}

        {valorarArriba ? valorar : null}
        <NotasAnteriores receta={receta} excluir={fechaValorar} />

        <section>
          <h2 className="subtitulo">Ingredientes · para {d.comensales}</h2>
          {visibles.map((ri) => (
            <div key={ri.id} className="ingrediente">
              <span>{ri.texto_original}</span>
              <span className="cant">{formatoCantidad(escalar(ri.cantidad, ri.unidad, factor), ri.unidad)}</span>
            </div>
          ))}
          {ingredientes.length > 5 ? (
            <button type="button" className="boton-texto" onClick={() => setTodos(!todos)}>
              {todos ? 'Ver menos' : `Ver los ${ingredientes.length} ingredientes`}
            </button>
          ) : null}
        </section>

        {receta.pasos?.length ? (
          <section>
            <h2 className="subtitulo" style={{ marginBottom: 12 }}>
              Pasos
            </h2>
            <ol className="pasos">
              {receta.pasos.map((p, i) => (
                <li key={i}>
                  <span>
                    <Resaltado texto={p.texto} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {!valorarArriba ? valorar : null}
      </main>

      <div className="barra-acciones">
        {comida ? (
          <a className="boton borde" href={`#/cambiar/${comida.id}`}>
            <Icono n="cambiar" />
            <span>Cambiar</span>
          </a>
        ) : null}
        <button className="boton flex" type="button" onClick={() => ir(comida ? `cocinar/${receta.id}/${comida.id}` : `cocinar/${receta.id}`)} disabled={!receta.pasos?.length}>
          Empezar a cocinar
        </button>
      </div>
    </div>
  );
}
