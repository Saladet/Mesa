import { useEffect, useRef, useState } from 'react';
import { useDatos } from '../datos.jsx';
import Icono from '../ui/Icono.jsx';
import { Resaltado } from '../ui/textos.jsx';
import { ElegirEstrellas } from '../ui/Estrellas.jsx';
import { UltimaVez } from '../ui/Notas.jsx';
import { ETIQUETAS, buscarValoracion } from '../logic/valoraciones.js';
import { hoyISO } from '../logic/fechas.js';
import { mensajeError } from '../supabase.js';
import { formatoCantidad, escalar } from '../logic/cantidades.js';
import { NoEncontrado } from './Plato.jsx';
import { volver, ir } from '../ruta.js';

function reloj(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Etiqueta corta para el temporizador: "Paso 5 · 35 min"
function nombreTemporizador(n, min) {
  return `Paso ${n} · ${min} min`;
}

export default function Cocinar({ recetaId, comidaId }) {
  const d = useDatos();
  const receta = d.recetasMap.get(recetaId);
  const comida = comidaId ? d.comidas.find((c) => c.id === comidaId) : null;
  const fechaValorar = comida?.fecha ?? hoyISO();
  const pasos = receta?.pasos || [];
  const [i, setI] = useState(0);
  const [temporizadores, setTemporizadores] = useState([]);
  const [ahora, setAhora] = useState(() => Date.now());
  const [terminado, setTerminado] = useState(false);
  const audio = useRef(null);

  // Que la pantalla no se apague mientras se cocina
  useEffect(() => {
    let bloqueo = null;
    let vivo = true;
    const pedir = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') bloqueo = await navigator.wakeLock.request('screen');
      } catch {
        /* el navegador no lo permite: no pasa nada */
      }
    };
    pedir();
    const alVolver = () => vivo && document.visibilityState === 'visible' && pedir();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      bloqueo?.release?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!temporizadores.length) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, [temporizadores.length]);

  // Aviso cuando acaba un temporizador
  useEffect(() => {
    const acabados = temporizadores.filter((t) => !t.sonado && ahora >= t.fin);
    if (!acabados.length) return;
    sonar();
    try {
      navigator.vibrate?.([300, 120, 300, 120, 600]);
    } catch {
      /* sin vibración */
    }
    setTemporizadores((ts) => ts.map((t) => (acabados.some((a) => a.id === t.id) ? { ...t, sonado: true } : t)));
  }, [ahora, temporizadores]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  if (!receta) return <NoEncontrado texto="No encuentro esta receta." />;

  function prepararAudio() {
    try {
      if (!audio.current) audio.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.current.state === 'suspended') audio.current.resume();
    } catch {
      audio.current = null;
    }
  }

  function sonar() {
    const ctx = audio.current;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + k * 0.45);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + k * 0.45 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * 0.45 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + k * 0.45);
      o.stop(t0 + k * 0.45 + 0.4);
    }
  }

  function empezarTemporizador(n, min) {
    prepararAudio();
    const id = `${n}-${Date.now()}`;
    const ya = Date.now();
    setAhora(ya);
    setTemporizadores((ts) => [...ts.filter((t) => t.paso !== n), { id, paso: n, etiqueta: nombreTemporizador(n, min), fin: ya + min * 60000, sonado: false }]);
  }

  function quitarTemporizador(id) {
    setTemporizadores((ts) => ts.filter((t) => t.id !== id));
  }

  function siguiente() {
    if (i < pasos.length - 1) setI(i + 1);
    else terminar();
  }

  function terminar() {
    setTerminado(true);
    d.acciones.marcarCocinada(receta);
  }

  const paso = pasos[i];
  const factor = d.comensales / (receta.raciones || 2);
  const delPaso = (paso?.ingredientes || [])
    .map((id) => (receta.receta_ingredientes || []).find((ri) => ri.ingrediente_id === id))
    .filter(Boolean)
    .map((ri) => (ri.unidad === 'al_gusto' || ri.cantidad == null ? ri.texto_original : `${ri.texto_original} · ${formatoCantidad(escalar(ri.cantidad, ri.unidad, factor), ri.unidad)}`));
  const delPasoActivo = temporizadores.find((t) => t.paso === i + 1);

  if (terminado) {
    const destino = comida ? `plato/${comida.id}` : `receta/${receta.id}`;
    const mia = d.yo ? buscarValoracion(d.valoraciones, receta.id, d.yo.id, fechaValorar) : null;
    const valor = mia?.puntuacion || 0;
    return (
      <div className="cocina app">
        <div className="fin-cocina">
          <h2>¡Que aproveche!</h2>
          <p>{receta.titulo}</p>
          {d.yo ? (
            <div className="fin-valorar">
              <span>{valor ? ETIQUETAS[valor] : 'Cuando lo probéis: ¿qué tal ha quedado?'}</span>
              <ElegirEstrellas
                valor={valor}
                etiqueta="Tu puntuación"
                deshabilitado={!d.enLinea}
                alCambiar={(n) =>
                  d.acciones.valorar({ receta, persona: d.yo, fecha: fechaValorar, puntuacion: n }).catch((e) => {
                    console.error(e);
                    d.avisar(mensajeError(e), 'error');
                  })
                }
              />
            </div>
          ) : null}
          {!receta.foto_url ? <p>¿Le hacéis una foto? Así la próxima vez sale en el menú.</p> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, marginTop: 10 }}>
            {valor ? (
              <button className="boton lima" type="button" onClick={() => ir(`${destino}?comentar`, { reemplazar: true })}>
                Añadir un comentario
              </button>
            ) : null}
            {!receta.foto_url ? (
              <button className={valor ? 'boton borde-oscuro' : 'boton lima'} type="button" onClick={() => ir(destino, { reemplazar: true })}>
                <Icono n="camara" />
                Hacer una foto
              </button>
            ) : null}
            <button className="boton borde-oscuro" type="button" onClick={() => volver('semana')}>
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cocina app">
      <header className="cocina-cab">
        <button className="boton-redondo-oscuro" type="button" onClick={() => volver(`receta/${receta.id}`)} aria-label="Salir del modo cocina">
          <Icono n="cerrar" t={18} />
        </button>
        <span className="nombre">{receta.titulo}</span>
        <span style={{ width: 44, flex: 'none' }} aria-hidden="true" />
      </header>

      <div className="segmentos" aria-hidden="true">
        {pasos.map((_, k) => (
          <span key={k} className={k <= i ? 'on' : ''} />
        ))}
      </div>

      {temporizadores.length ? (
        <div className="temporizadores" aria-live="polite">
          {temporizadores.map((t) => {
            const fin = ahora >= t.fin;
            return (
              <button
                key={t.id}
                type="button"
                className={`temporizador${fin ? ' fin' : ''}`}
                onClick={() => quitarTemporizador(t.id)}
                aria-label={fin ? `${t.etiqueta}: listo. Tocar para quitar` : `${t.etiqueta}: quedan ${reloj(t.fin - ahora)}. Tocar para cancelar`}
              >
                <Icono n={fin ? 'check' : 'reloj'} t={16} />
                <span>{fin ? `${t.etiqueta} · ¡listo!` : `${reloj(t.fin - ahora)} · paso ${t.paso}`}</span>
                <Icono n="cerrar" t={14} />
              </button>
            );
          })}
        </div>
      ) : null}

      <main className="cocina-cuerpo">
        {i === 0 ? <UltimaVez receta={receta} antesDe={fechaValorar} /> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="paso-n">
            Paso {i + 1} de {pasos.length}
          </span>
          <p className="paso-texto">
            <Resaltado texto={paso?.texto} como="mark" />
          </p>
        </div>

        {paso?.min && !delPasoActivo ? (
          <button className="boton-temporizador" type="button" onClick={() => empezarTemporizador(i + 1, paso.min)}>
            <Icono n="reloj" />
            <span>Temporizador · {paso.min} min</span>
          </button>
        ) : null}

        {delPaso.length ? (
          <div className="en-paso">
            <span>En este paso</span>
            <div className="lista-chips">
              {delPaso.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="cocina-pie">
        <div className="fila">
          <button className="boton borde-oscuro" type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            Anterior
          </button>
          <button className="boton lima flex" type="button" onClick={siguiente}>
            {i === pasos.length - 1 ? 'Terminar' : 'Siguiente'}
          </button>
        </div>
        <span className="nota">La pantalla se queda encendida mientras cocinas.</span>
      </footer>
    </div>
  );
}
