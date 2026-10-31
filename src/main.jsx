import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProveedorDatos } from './datos.jsx';
import App from './App.jsx';
import { aplicarTema, temaAlAbrir } from './tema.js';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/manrope/wght.css';
import './estilos.css';

aplicarTema(temaAlAbrir());

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <ProveedorDatos>
      <App />
    </ProveedorDatos>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
