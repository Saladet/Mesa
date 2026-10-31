import { useState } from 'react';
import { useDatos } from '../datos.jsx';
import { mensajeError } from '../supabase.js';
import { Dibujo } from '../ui/Portada.jsx';
import { marcaDe, temaGuardado } from '../tema.js';

export function Marca({ texto }) {
  return (
    <div className="marca">
      <Dibujo paleta={marcaDe(temaGuardado())} tam={72} grande={false} />
      <h1>Mesa</h1>
      {texto ? <p>{texto}</p> : null}
    </div>
  );
}

export default function Entrar({ invitado }) {
  const { acciones } = useDatos();
  const [modo, setModo] = useState(invitado ? 'crear' : 'entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const crear = modo === 'crear';

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setMensaje('');
    if (!email.trim() || !clave) {
      setError('Escribe tu email y una contraseña.');
      return;
    }
    if (crear && clave.length < 6) {
      setError('La contraseña necesita al menos 6 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      if (crear) {
        const r = await acciones.crearCuenta(email, clave);
        if (r.necesitaConfirmar) setMensaje('Cuenta creada. Te ha llegado un correo para confirmarla: ábrelo y volverás aquí ya dentro.');
      } else {
        await acciones.entrar(email, clave);
      }
    } catch (err) {
      const m = mensajeError(err);
      setError(!crear && /incorrectos/.test(m) ? `${m} Si todavía no tienes cuenta, toca «¿Primera vez? Crear cuenta».` : m);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-verde">
      <Marca
        texto={
          invitado
            ? 'Te han invitado a compartir el menú de la semana y la lista de la compra. Crea tu cuenta para entrar.'
            : 'El menú de la semana y la lista de la compra, para los dos.'
        }
      />
      <form className="formulario" onSubmit={enviar} noValidate>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="campo oscuro"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="clave">{crear ? 'Elige una contraseña' : 'Contraseña'}</label>
        <div className="campo-clave">
          <input
            id="clave"
            className="campo oscuro"
            type={ver ? 'text' : 'password'}
            autoComplete={crear ? 'new-password' : 'current-password'}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            {ver ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        {error ? <div className="error-form" role="alert">{error}</div> : null}
        {mensaje ? <div className="mensaje-form" role="status">{mensaje}</div> : null}
        <button className="boton lima ancho" type="submit" disabled={enviando}>
          {enviando ? 'Un momento…' : crear ? 'Crear cuenta' : 'Entrar'}
        </button>
        <button
          type="button"
          className="boton-texto claro"
          onClick={() => {
            setModo(crear ? 'entrar' : 'crear');
            setError('');
            setMensaje('');
          }}
        >
          {crear ? 'Ya tengo cuenta: entrar' : '¿Primera vez? Crear cuenta'}
        </button>
      </form>
    </div>
  );
}
