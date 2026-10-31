import { useEffect, useState } from 'react';
import { useDatos } from '../datos.jsx';
import Icono from '../ui/Icono.jsx';
import Avatar from '../ui/Avatar.jsx';
import { enumerar, minuscula } from '../ui/textos.jsx';
import { hoyISO, fechaCorta } from '../logic/fechas.js';
import { menusVivos, menuDeCompra, diasDelMenu } from '../logic/semanas.js';
import { SECCIONES, ordenSeccion } from '../logic/lista.js';
import { esPeque } from '../logic/raciones.js';

const memoria = { menuId: null };

function nombreSemana(menu, comidas, hoy) {
  const dias = diasDelMenu(menu, comidas);
  if (dias[0] <= hoy && dias[dias.length - 1] >= hoy) return 'Esta semana';
  if (dias[0] > hoy) return `Desde el ${fechaCorta(dias[0])}`;
  return `Semana del ${fechaCorta(dias[0])}`;
}

function Fila({ item, d }) {
  const quien = item.marcado && item.marcado_por ? d.personasMap.get(item.marcado_por) : null;
  const id = `item-${item.id}`;
  return (
    <div className="fila-lista">
      <label htmlFor={id}>
        <input id={id} type="checkbox" checked={item.marcado} onChange={(e) => d.acciones.marcarItem(item, e.target.checked)} />
        <span className="txt">
          <span className="nm">{item.nombre}</span>
          {item.congelar || item.nota ? (
            <span className="sub">
              {item.congelar ? (
                <span className="etiqueta-congelar">
                  <Icono n="copo" t={12} />
                  <span>Congelar al llegar</span>
                </span>
              ) : null}
              {item.nota ? <span>{item.nota}</span> : null}
            </span>
          ) : null}
        </span>
        {item.cantidad ? <span className="cant">{item.cantidad}</span> : null}
        {quien ? (
          <>
            <Avatar persona={quien} tam={22} fuente={11} />
            <span className="sr">marcado por {quien.nombre}</span>
          </>
        ) : null}
      </label>
      {item.manual ? (
        <button className="quitar" type="button" onClick={() => d.acciones.quitarDeLista(item)} aria-label={`Quitar ${item.nombre} de la lista`}>
          <Icono n="cerrar" t={16} />
        </button>
      ) : null}
    </div>
  );
}

export default function Lista() {
  const d = useDatos();
  const hoy = hoyISO();
  const vivos = menusVivos(d.menus, d.comidas, hoy);
  const defecto = menuDeCompra(d.menus, d.comidas, hoy);
  const [menuId, setMenuId] = useState(memoria.menuId);
  const [casaAbierta, setCasaAbierta] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());
  const menu = d.menus.find((m) => m.id === menuId && vivos.some((v) => v.id === m.id)) || defecto;

  useEffect(() => {
    memoria.menuId = menu?.id ?? null;
  });
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!menu) {
    return (
      <div className="app con-tabs">
        <section className="cabecera compacta">
          <h1 className="cab-titulo medio">Lista de la compra</h1>
        </section>
        <main className="cuerpo">
          <div className="vacio-suave">Cuando preparéis una semana, aquí aparecerá todo lo que hay que comprar.</div>
          <a className="boton" href="#/semana">
            Ir a la semana
          </a>
        </main>
      </div>
    );
  }

  const items = d.lista.filter((x) => x.menu_id === menu.id);
  const comprar = items.filter((x) => !x.en_casa);
  const enCasa = items.filter((x) => x.en_casa).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const hechos = comprar.filter((x) => x.marcado).length;
  const total = comprar.length;
  const nComidas = d.comidas.filter((c) => c.menu_id === menu.id && c.receta_id).length;

  const secciones = [];
  const porSeccion = new Map();
  for (const it of [...comprar].sort((a, b) => ordenSeccion(a.seccion) - ordenSeccion(b.seccion) || a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))) {
    const s = SECCIONES.includes(it.seccion) ? it.seccion : 'Otros';
    if (!porSeccion.has(s)) {
      porSeccion.set(s, []);
      secciones.push(s);
    }
    porSeccion.get(s).push(it);
  }

  // ¿Alguien más está marcando ahora mismo?
  const recientes = items
    .filter((x) => x.marcado && x.marcado_por && x.marcado_por !== d.yo?.id && x.marcado_at && ahora - new Date(x.marcado_at).getTime() < 180000)
    .map((x) => d.personasMap.get(x.marcado_por))
    .filter(Boolean);
  const activo = recientes[0] || null;
  const demas = d.personas.filter((p) => p.id !== d.yo?.id && !esPeque(p));

  let estado;
  if (total && hechos === total) estado = '¡Todo comprado!';
  else if (activo) estado = `${activo.nombre} está marcando ahora`;
  else if (demas.length) estado = `Compartida con ${enumerar(demas.map((p) => p.nombre))}`;
  else estado = 'Marca lo que vayas cogiendo';

  async function anadir(e) {
    e.preventDefault();
    if (!nuevo.trim()) return;
    const ok = await d.acciones.anadirALista(menu, nuevo);
    if (ok) setNuevo('');
  }

  return (
    <div className="app con-tabs">
      <section className="cabecera compacta">
        <header className="cab-textos">
          <span className="cab-sub">
            {nombreSemana(menu, d.comidas, hoy)} · {nComidas} comidas
          </span>
          <h1 className="cab-titulo medio">Lista de la compra</h1>
        </header>
        {vivos.length > 1 ? (
          <div className="selector-semana" role="group" aria-label="Qué semana">
            {vivos.map((m) => (
              <button key={m.id} type="button" className={m.id === menu.id ? 'on' : ''} aria-pressed={m.id === menu.id} onClick={() => setMenuId(m.id)}>
                {nombreSemana(m, d.comidas, hoy)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="progreso">
          <div className="progreso-fila">
            <span className="quien">
              {activo ? <Avatar persona={activo} tam={24} fuente={11} /> : null}
              <span>{estado}</span>
            </span>
            <span className="progreso-cuenta">
              {hechos} de {total}
            </span>
          </div>
          <span className="barra" aria-hidden="true">
            <span style={{ width: `${total ? (hechos / total) * 100 : 0}%` }} />
          </span>
        </div>
      </section>

      <main className="cuerpo cerca">
        {secciones.map((s) => (
          <section key={s} className="seccion-lista">
            <h2 className="etiqueta-seccion">{s}</h2>
            {porSeccion.get(s).map((it) => (
              <Fila key={it.id} item={it} d={d} />
            ))}
          </section>
        ))}
        {!total ? <div className="vacio-suave">No hay nada que comprar para esta semana.</div> : null}

        {enCasa.length ? (
          <div className="bloque">
            <button
              type="button"
              className={`en-casa${casaAbierta ? ' abierto' : ''}`}
              aria-expanded={casaAbierta}
              onClick={() => setCasaAbierta(!casaAbierta)}
            >
              <span>
                Ya en casa · {enumerar(enCasa.slice(0, 3).map((x) => minuscula(x.nombre)).concat(enCasa.length > 3 ? [`${enCasa.length - 3} más`] : []))}
              </span>
              <Icono n="derecha" t={18} />
            </button>
            {casaAbierta ? (
              <div className="lista-casa">
                <span className="nota-gris">Lo básico que suele haber en casa. Si se ha acabado algo, pásalo a la lista.</span>
                {enCasa.map((it) => (
                  <div key={it.id} className="fila-casa">
                    <span>{it.nombre}</span>
                    <button type="button" onClick={() => d.acciones.ponerEnCasa(it, false)}>
                      Me falta
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <form className="anadir-lista" onSubmit={anadir}>
          <label htmlFor="anadir" className="sr">
            Añadir algo a la lista
          </label>
          <input id="anadir" className="campo" type="text" placeholder="Añadir algo más…" value={nuevo} onChange={(e) => setNuevo(e.target.value)} enterKeyHint="done" />
          <button className="boton peq" type="submit" disabled={!nuevo.trim()}>
            Añadir
          </button>
        </form>
      </main>
    </div>
  );
}
