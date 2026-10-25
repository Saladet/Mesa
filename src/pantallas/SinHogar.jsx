import { useState } from 'react';
import { useDatos } from '../datos.jsx';
import { Marca } from './Entrar.jsx';

export default function SinHogar() {
  const d = useDatos();
  const [mirando, setMirando] = useState(false);
  const error = d.estado === 'error';
  return (
    <div className="pantalla-verde">
      <Marca
        texto={
          error
            ? 'No se ha podido cargar la casa. Revisa la conexión y vuelve a probar.'
            : 'Tu cuenta todavía no está en ninguna casa. Si te han invitado, abre el enlace de la invitación en este móvil.'
        }
      />
      <div className="formulario">
        <div className="mensaje-form">Has entrado como {d.sesion?.user?.email}</div>
        <button
          className="boton lima ancho"
          type="button"
          disabled={mirando}
          onClick={async () => {
            setMirando(true);
            await d.recargar();
            setMirando(false);
          }}
        >
          {mirando ? 'Comprobando…' : 'Volver a comprobar'}
        </button>
        <button className="boton-texto claro" type="button" onClick={() => d.acciones.salir()}>
          Entrar con otra cuenta
        </button>
      </div>
    </div>
  );
}
