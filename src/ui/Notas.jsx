// Valorar un plato (estrellas + comentario) y ver lo que dijisteis otras veces.
import { useEffect, useState } from 'react';
import { useDatos } from '../datos.jsx';
import Avatar from './Avatar.jsx';
import Portada from './Portada.jsx';
import { ElegirEstrellas, Puntuacion } from './Estrellas.jsx';
import { mensajeError } from '../supabase.js';
import { hoyISO } from '../logic/fechas.js';
import {
  ETIQUETAS,
  ATAJOS,
  alternarAtajo,
  tieneAtajo,
  buscarValoracion,
  notasPorDia,
  ultimosComentarios,
  pendienteDeValorar,
  cuandoFue,
  cuandoFecha,
} from '../logic/valoraciones.js';

const CLAVE_DESCARTADAS = 'mesa-valorar-luego';

function leerDescartadas() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_DESCARTADAS) || '[]'));
  } catch {
    return new Set();
  }
}

function guardarDescartadas(conjunto) {
  try {
    localStorage.setItem(CLAVE_DESCARTADAS, JSON.stringify([...conjunto].slice(-40)));
  } catch {
    /* sin almacenamiento: se volverá a preguntar */
  }
}

// Puede escribir la suya y la de quien todavía no tiene cuenta
export function puedeValorarPor(persona, yo) {
  return !!persona && !!yo && (persona.id === yo.id || !persona.user_id);
}

function FormularioPersona({ persona, receta, fecha, editable, esYo, abrirComentario }) {
  const d = useDatos();
  const valoracion = buscarValoracion(d.valoraciones, receta.id, persona.id, fecha);
  const guardado = valoracion?.comentario || '';
  const [texto, setTexto] = useState(guardado);
  const [abierto, setAbierto] = useState(!!guardado || (esYo && !!abrirComentario));
  const [guardando, setGuardando] = useState(false);
  const sucio = texto.trim() !== guardado.trim();
  const nombre = esYo ? 'Tú' : persona.nombre;

  // Si llega un cambio de fuera y no estabas escribiendo, se actualiza
  useEffect(() => {
    if (!sucio) setTexto(guardado);
    if (guardado) setAbierto(true);
  }, [guardado]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(cambios, aviso) {
    try {
      await d.acciones.valorar({ receta, persona, fecha, ...cambios });
      if (aviso) d.avisar(aviso);
    } catch (e) {
      console.error(e);
      d.avisar(mensajeError(e), 'error');
    }
  }

  async function guardarComentario() {
    setGuardando(true);
    await guardar({ comentario: texto }, texto.trim() ? 'Guardado. Lo veréis la próxima vez que salga.' : 'Comentario quitado.');
    setGuardando(false);
  }

  if (!editable) {
    return (
      <div className="valorar-persona">
        <div className="valorar-cab">
          <Avatar persona={persona} tam={30} />
          <span>{nombre}</span>
          {valoracion?.puntuacion ? <span className="etiqueta-nota">{ETIQUETAS[valoracion.puntuacion]}</span> : null}
        </div>
        {valoracion ? (
          <>
            {valoracion.puntuacion ? <Puntuacion valor={valoracion.puntuacion} t={20} /> : null}
            {valoracion.comentario ? <p className="cita">«{valoracion.comentario}»</p> : null}
          </>
        ) : (
          <span className="meta">Todavía no ha dicho nada.</span>
        )}
      </div>
    );
  }

  return (
    <div className="valorar-persona">
      <div className="valorar-cab">
        <Avatar persona={persona} tam={30} />
        <span>
          {nombre}
          {!esYo ? <small> · lo apuntas tú</small> : null}
        </span>
        {valoracion?.puntuacion ? <span className="etiqueta-nota">{ETIQUETAS[valoracion.puntuacion]}</span> : null}
      </div>
      <ElegirEstrellas
        valor={valoracion?.puntuacion || 0}
        etiqueta={`Puntuación de ${esYo ? 'ti' : persona.nombre}`}
        deshabilitado={!d.enLinea}
        alCambiar={(n) => guardar({ puntuacion: n })}
      />
      {abierto ? (
        <>
          <label className="sr" htmlFor={`comentario-${persona.id}`}>
            Comentario de {nombre}
          </label>
          <textarea
            id={`comentario-${persona.id}`}
            className="comentario"
            rows={2}
            maxLength={1000}
            autoFocus={esYo && !!abrirComentario}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Qué cambiaríais la próxima vez: más sal, menos horno…"
          />
          <div className="atajos" role="group" aria-label="Frases rápidas">
            {ATAJOS.map((a) => {
              const on = tieneAtajo(texto, a);
              return (
                <button key={a} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setTexto(alternarAtajo(texto, a))}>
                  {a}
                </button>
              );
            })}
          </div>
          <div className="valorar-acciones">
            {sucio ? (
              <button className="boton peq" type="button" disabled={guardando || !d.enLinea} onClick={guardarComentario}>
                {guardando ? 'Guardando…' : 'Guardar comentario'}
              </button>
            ) : null}
            {valoracion ? (
              <button
                className="boton-texto gris"
                type="button"
                disabled={!d.enLinea}
                onClick={() => {
                  setTexto('');
                  guardar({ puntuacion: null, comentario: '' }, 'Valoración quitada.');
                }}
              >
                Quitar mi valoración
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <button className="boton-texto" type="button" onClick={() => setAbierto(true)}>
          Añadir un comentario
        </button>
      )}
    </div>
  );
}

// "¿Qué tal estuvo?" para cada persona de la casa
export function ValorarComida({ receta, fecha, abrirComentario }) {
  const d = useDatos();
  const hoy = hoyISO();
  const personas = [...d.personas].sort((a, b) => (a.id === d.yo?.id ? -1 : b.id === d.yo?.id ? 1 : (a.orden || 0) - (b.orden || 0)));
  return (
    <section className="valorar" id="valorar" aria-labelledby="titulo-valorar">
      <h2 id="titulo-valorar" className="subtitulo">
        {fecha === hoy ? '¿Qué tal ha salido?' : '¿Qué tal estuvo?'}
      </h2>
      {personas.map((p) => (
        <FormularioPersona
          key={p.id}
          persona={p}
          receta={receta}
          fecha={fecha}
          esYo={p.id === d.yo?.id}
          editable={puedeValorarPor(p, d.yo)}
          abrirComentario={abrirComentario}
        />
      ))}
    </section>
  );
}

// Lo que dijisteis otras veces (lo más reciente primero)
export function NotasAnteriores({ receta, excluir }) {
  const d = useDatos();
  const [todas, setTodas] = useState(false);
  const hoy = hoyISO();
  const grupos = notasPorDia(d.valoraciones, receta.id, d.personas).filter((g) => g.fecha !== excluir);
  if (!grupos.length) return null;
  const visibles = todas ? grupos : grupos.slice(0, 2);
  return (
    <section className="notas" aria-labelledby="titulo-notas">
      <h2 id="titulo-notas" className="subtitulo">
        {excluir ? 'Otras veces' : 'Lo que dijisteis'}
      </h2>
      {visibles.map((g) => (
        <div key={g.fecha} className="nota-grupo">
          <span className="nota-fecha">{cuandoFecha(g.fecha, hoy)}</span>
          {g.lista.map((v) => {
            const p = d.personasMap.get(v.persona_id);
            return (
              <div key={v.id} className="nota-fila">
                <Avatar persona={p || { nombre: '?' }} tam={28} />
                <div className="nota-txt">
                  <span className="nota-quien">
                    {p?.id === d.yo?.id ? 'Tú' : p?.nombre || 'Alguien'}
                    {v.puntuacion ? <Puntuacion valor={v.puntuacion} /> : null}
                  </span>
                  {v.comentario ? <p>«{v.comentario}»</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {grupos.length > 2 ? (
        <button type="button" className="boton-texto" onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : `Ver las ${grupos.length} veces`}
        </button>
      ) : null}
    </section>
  );
}

// En el modo cocina: lo que comentasteis la última vez
export function UltimaVez({ receta, antesDe }) {
  const d = useDatos();
  const notas = ultimosComentarios(d.valoraciones, receta.id, antesDe);
  if (!notas.length) return null;
  return (
    <div className="ultima-vez">
      <span>La última vez dijisteis</span>
      {notas.map((v) => {
        const p = d.personasMap.get(v.persona_id);
        return (
          <p key={v.id}>
            «{v.comentario}»{p ? <small> · {p.id === d.yo?.id ? 'tú' : p.nombre}</small> : null}
          </p>
        );
      })}
    </div>
  );
}

// En la semana: "¿Qué tal estuvo…?" con el último plato que no has valorado
export function AvisoValorar() {
  const d = useDatos();
  const [descartadas, setDescartadas] = useState(leerDescartadas);
  const [hecha, setHecha] = useState(null);
  const hoy = hoyISO();
  const hora = new Date().getHours();
  const comida = hecha
    ? hecha.comida
    : pendienteDeValorar({ comidas: d.comidas, valoraciones: d.valoraciones, persona: d.yo, hoy, hora, descartadas });
  const receta = comida ? d.recetasMap.get(comida.receta_id) : null;
  if (!comida || !receta || !d.yo) return null;

  async function puntuar(n) {
    setHecha({ comida, puntuacion: n });
    try {
      await d.acciones.valorar({ receta, persona: d.yo, fecha: comida.fecha, puntuacion: n });
    } catch (e) {
      console.error(e);
      setHecha(null);
      d.avisar(mensajeError(e), 'error');
    }
  }

  function luego() {
    const s = new Set(descartadas);
    s.add(comida.id);
    guardarDescartadas(s);
    setDescartadas(s);
  }

  return (
    <section className="aviso-valorar" aria-label="Valorar un plato">
      <a className="aviso-valorar-plato" href={`#/plato/${comida.id}`}>
        <Portada receta={receta} forma="mini" />
        <span className="aviso-valorar-textos">
          <span className="momento">{cuandoFue(comida, hoy)}</span>
          <span className="aviso-valorar-titulo">{receta.titulo}</span>
        </span>
      </a>
      {hecha ? (
        <>
          <p className="aviso-valorar-gracias">
            Apuntado: <strong>{ETIQUETAS[hecha.puntuacion].toLowerCase()}</strong>. ¿Algo que recordar para la próxima vez?
          </p>
          <div className="valorar-acciones">
            <a className="boton peq borde" href={`#/plato/${comida.id}?comentar`}>
              Añadir un comentario
            </a>
            <button type="button" className="boton-texto gris" onClick={() => setHecha(null)}>
              Listo
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>{comida.fecha === hoy ? '¿Qué tal ha estado?' : '¿Qué tal estuvo?'}</h3>
          <div className="aviso-valorar-fila">
            <ElegirEstrellas etiqueta="Tu puntuación" alCambiar={puntuar} deshabilitado={!d.enLinea} />
            <button type="button" className="boton-texto gris" onClick={luego}>
              Ahora no
            </button>
          </div>
        </>
      )}
    </section>
  );
}
