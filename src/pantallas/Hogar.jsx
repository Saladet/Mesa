import { useEffect, useState } from 'react';
import { useDatos } from '../datos.jsx';
import Icono from '../ui/Icono.jsx';
import Avatar from '../ui/Avatar.jsx';
import { enumerar } from '../ui/textos.jsx';
import { interpretar } from '../logic/restricciones.js';
import { GRUPOS, NIVELES, nombreRestriccion, reglasCompletas, esBloqueante } from '../logic/reglas.js';
import { mensajeError } from '../supabase.js';
import { VERSION } from '../config.js';

const DIAS_COMPRA = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miércoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sábado'],
  [0, 'Domingo'],
];
const COMIDAS = [
  ['desayuno', 'Desayuno'],
  ['comida', 'Comida'],
  ['cena', 'Cena'],
];
const REGLAS = [
  ['legumbre_min', 'Legumbre', 'Platos a la semana, como mínimo', 0, 14],
  ['carne_max', 'Carne', 'Platos a la semana, como máximo', 0, 14],
  ['huevos_max', 'Huevo', 'Platos con huevo a la semana, como máximo', 0, 14],
  ['caprichos_max', 'Caprichos', 'A la semana, como máximo', 0, 7],
];
const ORDEN_NIVEL = ['no_come', 'alergia', 'mejor_poco'];

function Restriccion({ r, d }) {
  const [quitando, setQuitando] = useState(false);
  useEffect(() => {
    if (!quitando) return undefined;
    const t = setTimeout(() => setQuitando(false), 3500);
    return () => clearTimeout(t);
  }, [quitando]);
  const nombre = nombreRestriccion(r, d.ingMap);
  const clase = r.nivel === 'mejor_poco' ? 'restriccion suave' : r.nivel === 'alergia' ? 'restriccion alergia' : 'restriccion';
  return (
    <button
      type="button"
      className={`${clase}${quitando ? ' quitando' : ''}`}
      aria-label={quitando ? `Quitar ${nombre}` : `${nombre}: ${NIVELES[r.nivel].toLowerCase()}${r.nota ? `, ${r.nota}` : ''}. Tocar para quitar`}
      onClick={() => (quitando ? d.acciones.quitarRestriccion(r) : setQuitando(true))}
    >
      {quitando ? (
        <>
          <Icono n="cerrar" t={14} /> Quitar {nombre.toLowerCase()}
        </>
      ) : (
        <>
          {nombre}
          {r.nota ? ` · ${r.nota}` : ''}
        </>
      )}
    </button>
  );
}

function AnadirRestriccion({ persona, d }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [nivel, setNivel] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const interpretada = texto.trim() ? interpretar(texto, d.ingredientes) : null;
  const final = interpretada ? { ...interpretada, nivel: nivel || interpretada.nivel } : null;

  if (!abierto) {
    return (
      <button type="button" className="pastilla-anadir" onClick={() => setAbierto(true)}>
        <Icono n="mas" t={16} />
        <span>Añadir</span>
      </button>
    );
  }

  async function confirmar() {
    if (!final) return;
    setGuardando(true);
    try {
      await d.acciones.anadirRestriccion(persona, final);
      setTexto('');
      setNivel(null);
      setAbierto(false);
      d.avisar(`Guardado. Las próximas propuestas ya lo tienen en cuenta.`);
    } catch (e) {
      d.avisar(mensajeError(e), 'error');
    } finally {
      setGuardando(false);
    }
  }

  const id = `nueva-${persona.id}`;
  return (
    <div className="bloque">
      <label htmlFor={id} className="bloque-titulo">
        Añadir
      </label>
      <input
        id={id}
        className="campo"
        type="text"
        autoFocus
        placeholder="Por ejemplo: la remolacha, ni verla"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setNivel(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && confirmar()}
      />
      {final ? (
        <div className="vista-previa">
          <span className="nota-gris" style={{ fontSize: 13, fontWeight: 600 }}>
            Lo guardo así:
          </span>
          <div className="que">
            <b>{final.nombre}</b>
            <span>
              {NIVELES[final.nivel]} · {final.tipo === 'grupo' ? 'grupo de alimentos' : 'ingrediente'}
              {final.nota ? ` · ${final.nota}` : ''}
            </span>
          </div>
          <div className="niveles" role="group" aria-label="Cuánto">
            {Object.entries(NIVELES).map(([k, t]) => (
              <button key={k} type="button" className={`chip peq${final.nivel === k ? ' on' : ''}`} aria-pressed={final.nivel === k} onClick={() => setNivel(k)}>
                {t}
              </button>
            ))}
          </div>
          {final.tipo === 'grupo' && GRUPOS[final.valor]?.nota ? <span className="nota-gris">{GRUPOS[final.valor].nota}</span> : null}
          <div className="fila">
            <button type="button" className="boton-texto gris" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className="boton peq" onClick={confirmar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="boton-texto gris" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      )}
    </div>
  );
}

function Invitar({ persona, d }) {
  const [enlace, setEnlace] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  async function compartir() {
    setTrabajando(true);
    let url;
    try {
      url = await d.acciones.invitar(persona);
      setEnlace(url);
    } catch (e) {
      d.avisar(mensajeError(e), 'error');
      setTrabajando(false);
      return;
    }
    const texto = `${d.yo?.nombre || 'Te'} te invita a Mesa: el menú de la semana y la lista de la compra compartida. Entra aquí y crea tu cuenta:`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mesa', text: texto, url });
      } else {
        await navigator.clipboard.writeText(`${texto} ${url}`);
        d.avisar('Enlace copiado. Pégalo en WhatsApp.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') d.avisar('Copia el enlace de abajo y mándaselo.');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="invitar">
      <span>
        {persona.nombre} todavía no tiene cuenta. Mándale el enlace: al abrirlo crea su cuenta y entra directamente a esta casa.
      </span>
      <button type="button" className="boton peq" onClick={compartir} disabled={trabajando || !d.enLinea} style={{ alignSelf: 'flex-start' }}>
        <Icono n="compartir" t={18} />
        Invitar a {persona.nombre}
      </button>
      {enlace ? <span className="enlace">{enlace}</span> : null}
    </div>
  );
}

function TarjetaPersona({ persona, d }) {
  const [quitar, setQuitar] = useState(false);
  const suyas = d.restricciones.filter((r) => r.persona_id === persona.id);
  const grupos = ORDEN_NIVEL.map((n) => [n, suyas.filter((r) => r.nivel === n)]).filter(([, rs]) => rs.length);
  const esYo = persona.id === d.yo?.id;
  return (
    <article className="persona">
      <div className="persona-cab">
        <Avatar persona={persona} tam={38} fuente={14} />
        <span className="persona-nombre">{persona.nombre}</span>
        {esYo ? <span className="tu">Tú</span> : null}
      </div>
      <div className="separador" aria-hidden="true" />
      {grupos.length ? (
        grupos.map(([nivel, rs]) => (
          <div key={nivel} className="bloque">
            <span className="bloque-titulo">{NIVELES[nivel]}</span>
            <div className="restricciones">
              {rs.map((r) => (
                <Restriccion key={r.id} r={r} d={d} />
              ))}
            </div>
            {rs.map((r) => (r.tipo === 'grupo' && GRUPOS[r.valor]?.nota && nivel !== 'mejor_poco' ? <span key={`n${r.id}`} className="nota-gris">{GRUPOS[r.valor].nota}</span> : null))}
          </div>
        ))
      ) : (
        <span className="meta" style={{ fontSize: 14 }}>
          Sin restricciones por ahora.
        </span>
      )}
      <AnadirRestriccion persona={persona} d={d} />
      {!persona.user_id ? <Invitar persona={persona} d={d} /> : null}
      {!persona.user_id && !esYo ? (
        <button
          type="button"
          className="boton-texto gris"
          onClick={() => {
            if (quitar) d.acciones.quitarPersona(persona);
            else {
              setQuitar(true);
              setTimeout(() => setQuitar(false), 3500);
            }
          }}
        >
          {quitar ? `Toca otra vez para quitar a ${persona.nombre}` : `Quitar a ${persona.nombre} de la casa`}
        </button>
      ) : null}
    </article>
  );
}

function AnadirPersona({ d }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  if (!abierto) {
    return (
      <button type="button" className="boton-texto" onClick={() => setAbierto(true)}>
        <Icono n="mas" t={18} />
        <span>Añadir persona</span>
      </button>
    );
  }
  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    try {
      await d.acciones.anadirPersona(nombre);
      setNombre('');
      setAbierto(false);
    } catch (err) {
      d.avisar(mensajeError(err), 'error');
    }
  }
  return (
    <form className="anadir-lista" onSubmit={guardar}>
      <label htmlFor="nueva-persona" className="sr">
        Nombre
      </label>
      <input id="nueva-persona" className="campo" autoFocus placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <button className="boton peq" type="submit" disabled={!nombre.trim()}>
        Añadir
      </button>
    </form>
  );
}

export default function Hogar() {
  const d = useDatos();
  const hogar = d.hogar;
  const reglas = reglasCompletas(hogar?.reglas);
  const comidas = hogar?.comidas || ['comida', 'cena'];
  const sinPescado = d.restricciones.filter((r) => r.tipo === 'grupo' && r.valor === 'pescado' && esBloqueante(r));
  const quienesSinPescado = [...new Set(sinPescado.map((r) => d.personasMap.get(r.persona_id)?.nombre).filter(Boolean))];

  function alternarComida(id) {
    const s = new Set(comidas);
    if (s.has(id)) {
      if (s.size === 1) return;
      s.delete(id);
    } else s.add(id);
    d.acciones.actualizarHogar({ comidas: COMIDAS.map(([k]) => k).filter((k) => s.has(k)) });
  }

  function cambiarRegla(clave, delta, min, max) {
    const valor = Math.min(max, Math.max(min, reglas[clave] + delta));
    if (valor === reglas[clave]) return;
    d.acciones.actualizarHogar({ reglas: { ...reglas, [clave]: valor } });
  }

  return (
    <div className="app con-tabs">
      <section className="cabecera compacta" style={{ gap: 6 }}>
        <h1 className="cab-titulo medio">Hogar</h1>
        <p className="cab-texto">Lo que la app tiene en cuenta al proponer el menú.</p>
      </section>

      <main className="cuerpo" style={{ gap: 22 }}>
        <section className="bloque" style={{ gap: 10 }}>
          <h2 className="etiqueta-seccion" style={{ margin: 0 }}>
            Quiénes comen
          </h2>
          {d.personas.map((p) => (
            <TarjetaPersona key={p.id} persona={p} d={d} />
          ))}
          <AnadirPersona d={d} />
        </section>

        <fieldset className="grupo">
          <legend className="etiqueta-seccion" style={{ margin: '0 0 10px' }}>
            Qué comidas planificamos
          </legend>
          <div className="chips-sel">
            {COMIDAS.map(([id, texto]) => (
              <label key={id} className="chip">
                <input type="checkbox" checked={comidas.includes(id)} onChange={() => alternarComida(id)} />
                <span>{texto}</span>
              </label>
            ))}
          </div>
          <span className="nota-gris" style={{ display: 'block', marginTop: 8 }}>
            Se aplica a las semanas nuevas.
          </span>
        </fieldset>

        <div className="bloque">
          <label htmlFor="dia-compra" className="etiqueta-seccion" style={{ margin: 0 }}>
            Día de compra
          </label>
          <select
            id="dia-compra"
            className="selector"
            value={hogar?.dia_compra ?? 1}
            onChange={(e) => d.acciones.actualizarHogar({ dia_compra: Number(e.target.value) })}
          >
            {DIAS_COMPRA.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <span className="nota-gris">Cada semana empieza ese día: lo que caduca antes va primero y lo que dura menos se congela al llegar.</span>
        </div>

        <div className="bloque">
          <label htmlFor="dia-especial" className="etiqueta-seccion" style={{ margin: 0 }}>
            Plato especial
          </label>
          <div className="fila-selectores">
            <select
              id="dia-especial"
              className="selector"
              value={hogar?.dia_especial ?? 'no'}
              onChange={(e) => d.acciones.actualizarHogar({ dia_especial: e.target.value === 'no' ? null : Number(e.target.value) })}
            >
              {DIAS_COMPRA.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
              <option value="no">Ninguno</option>
            </select>
            <select
              className="selector"
              aria-label="Comida o cena del plato especial"
              value={hogar?.tipo_especial || 'comida'}
              disabled={hogar?.dia_especial == null}
              onChange={(e) => d.acciones.actualizarHogar({ tipo_especial: e.target.value })}
            >
              <option value="comida">Comida</option>
              <option value="cena">Cena</option>
            </select>
          </div>
          <span className="nota-gris">
            Una receta más elaborada a la semana. Dos días antes te avisa de lo que hay que preparar. Se aplica a las semanas nuevas; en la semana entera puedes moverlo a otro día.
          </span>
        </div>

        <section>
          <h2 className="etiqueta-seccion" style={{ margin: '0 0 2px' }}>
            Reglas de la semana
          </h2>
          {REGLAS.map(([clave, nombre, ayuda, min, max]) => (
            <div key={clave} className="regla">
              <span className="regla-textos">
                <b>{nombre}</b>
                <span>{ayuda}</span>
              </span>
              <span className="stepper">
                <button type="button" aria-label={`Menos: ${nombre}`} onClick={() => cambiarRegla(clave, -1, min, max)} disabled={reglas[clave] <= min}>
                  <Icono n="menos" t={16} />
                </button>
                <output aria-live="polite">{reglas[clave]}</output>
                <button type="button" aria-label={`Más: ${nombre}`} onClick={() => cambiarRegla(clave, 1, min, max)} disabled={reglas[clave] >= max}>
                  <Icono n="mas" t={16} />
                </button>
              </span>
            </div>
          ))}
          {quienesSinPescado.length ? (
            <div className="regla">
              <span className="regla-textos">
                <b>Pescado</b>
                <span>
                  {enumerar(quienesSinPescado)} no lo {quienesSinPescado.length > 1 ? 'comen' : 'come'}
                </span>
              </span>
              <span className="valor-fijo">Nunca</span>
            </div>
          ) : null}
        </section>

        <section className="cuenta">
          <span>
            Has entrado como <b>{d.sesion?.user?.email}</b>
          </span>
          <button type="button" className="boton-texto gris" onClick={() => d.acciones.salir()}>
            <Icono n="salir" t={18} />
            Cerrar sesión
          </button>
        </section>
        <p className="pie-version">Mesa {VERSION}</p>
      </main>
    </div>
  );
}
