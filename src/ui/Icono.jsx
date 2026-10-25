const TRAZOS = {
  semana: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  lista: <><path d="M5.5 8h13l-1 12.5h-11z" /><path d="M9 8V7a3 3 0 0 1 6 0v1" /></>,
  recetas: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" /></>,
  hogar: <path d="M4 10.5 12 4l8 6.5V20h-5v-5.5H9V20H4z" />,
  cambiar: <><path d="M7 4 3.5 7.5 7 11" /><path d="M3.5 7.5H16" /><path d="m17 13 3.5 3.5L17 20" /><path d="M20.5 16.5H8" /></>,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  camara: <><path d="M4 8.5h3.2L9 6h6l1.8 2.5H20V19H4z" /><circle cx="12" cy="13.5" r="3.2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  atras: <path d="M19 12H5M11 6l-6 6 6 6" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  derecha: <path d="m9.5 6 6 6-6 6" />,
  izquierda: <path d="m14.5 6-6 6 6 6" />,
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  copo: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />,
  compartir: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v7.5h14V12" /></>,
  aviso: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  enlace: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" /></>,
  chispa: <path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z" />,
  pausa: <path d="M9 6v12M15 6v12" />,
  salir: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  mover: <><path d="M12 3.5v17M3.5 12h17" /><path d="m9 6.5 3-3 3 3M9 17.5l3 3 3-3M6.5 9l-3 3 3 3M17.5 9l3 3-3 3" /></>,
};

export default function Icono({ n, t = 20, className = '' }) {
  return (
    <svg className={`ic ${className}`} viewBox="0 0 24 24" width={t} height={t} aria-hidden="true">
      {TRAZOS[n]}
    </svg>
  );
}
