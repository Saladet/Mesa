import { Fragment, useEffect, useState } from 'react';
import { useDatos } from '../datos.jsx';
import Icono from '../ui/Icono.jsx';
import Portada from '../ui/Portada.jsx';
import { Avatares } from '../ui/Avatar.jsx';
import { tiempo, origen, minuscula, enumerar } from '../ui/textos.jsx';
import { hoyISO, sumarDias, parseFecha, DIAS_CORTOS, etiquetaDia, fechaCorta, diasEntre } from '../logic/fechas.js';
import { diasDelMenu, menuDeHoy, ordenarMenus, finDelMenu, TIPOS_ORDEN, NOMBRE_TIPO } from '../logic/semanas.js';
import { contarSemana, chipsSemana, conflictosReceta, esBloqueante, nombreRestriccion } from '../logic/reglas.js';
import { descongelarPara } from '../logic/lista.js';
import { siguienteInicio } from '../logic/generar.js';
import { formatoMedia } from '../logic/valoraciones.js';
import { AvisoValorar } from '../ui/Notas.jsx';

// Se recuerda qué semana y qué día estabais mirando al volver de un plato
const memoria = { menuId: null, dia: null };

function leerVista() {
  try {
    return localStorage.getItem('mesa-vista') === 'semana' ? 'semana' : 'dia';
  } catch {
    return 'dia';
  }
}

// Toda la semana de un vistazo: una fila por día y una columna por comida
function Tablero({ d, dias, comidasMenu, hoy, alElegirDia }) {
  const tipos = [...new Set(comidasMenu.map((c) => c.tipo))].sort((a, b) => TIPOS_ORDEN[a] - TIPOS_ORDEN[b]);
  if (!tipos.length) return <div className="vacio-suave">Esta semana no tiene platos.</div>;
  return (
    <div className="tablero" style={{ gridTemplateColumns: `46px repeat(${tipos.length}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" />
      {tipos.map((t) => (
        <span key={t} className="tablero-cab">
          {NOMBRE_TIPO[t]}
        </span>
      ))}
      {dias.map((f) => {
        const fecha = parseFecha(f);
        return (
          <Fragment key={f}>
            <button
              type="button"
              className={`tablero-dia${f === hoy ? ' hoy' : ''}`}
              onClick={() => alElegirDia(f)}
              aria-label={`Ver el ${etiquetaDia(f).toLowerCase()}${f === hoy ? ', hoy' : ''}`}
            >
              <span className="letra">{DIAS_CORTOS[fecha.getDay()]}</span>
              <span className="num">{fecha.getDate()}</span>
            </button>
            {tipos.map((t) => {
              const c = comidasMenu.find((x) => x.fecha === f && x.tipo === t);
              if (!c) return <span key={t} aria-hidden="true" />;
              const r = d.recetasMap.get(c.receta_id);
              if (!r) {
                return (
                  <a key={t} className="celda vacia" href={`#/cambiar/${c.id}`} aria-label={`${NOMBRE_TIPO[t]} del ${etiquetaDia(f).toLowerCase()}: libre. Elegir plato`}>
                    Libre
                  </a>
                );
              }
              return (
                <a key={t} className="celda" href={`#/plato/${c.id}`} aria-label={`${NOMBRE_TIPO[t]} del ${etiquetaDia(f).toLowerCase()}: ${r.titulo}`}>
                  <Portada receta={r} forma="casilla" />
                  <span className="celda-titulo">{r.titulo}</span>
                  <span className="celda-meta">
                    {tiempo(r.tiempo_min)}
                    {r.capricho ? ' · capricho' : ''}
                  </span>
                </a>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

function tituloSemana(menu, dias, hoy, orden) {
  if (!menu) return 'Mesa';
  if (dias[0] <= hoy && dias[dias.length - 1] >= hoy) return 'Esta semana';
  if (dias[0] > hoy) {
    const actual = orden.find((m) => m.semana_inicio <= hoy && m.id !== menu.id);
    return actual || diasEntre(hoy, dias[0]) <= 7 ? 'Próxima semana' : `Semana del ${fechaCorta(dias[0])}`;
  }
  return diasEntre(dias[dias.length - 1], hoy) <= 7 ? 'Semana pasada' : `Semana del ${fechaCorta(dias[0])}`;
}

function Conflictos({ receta }) {
  const d = useDatos();
  const graves = conflictosReceta(receta, d.restricciones, d.ingMap).filter(esBloqueante);
  if (!graves.length) return null;
  return graves.map((r) => (
    <span key={r.id} className="conflicto">
      <Icono n="aviso" t={14} />
      Lleva {minuscula(nombreRestriccion(r, d.ingMap))} · {d.personasMap.get(r.persona_id)?.nombre} no {r.nivel === 'alergia' ? 'puede' : 'come'}
    </span>
  ));
}

function HuecoVacio({ comida }) {
  return (
    <a className="hueco-vacio" href={`#/cambiar/${comida.id}`}>
      <span>
        <span className="momento">{NOMBRE_TIPO[comida.tipo]}</span>
        <br />
        <strong>Sin plato</strong> · no cocináis
      </span>
      <span className="boton-texto">Elegir</span>
    </a>
  );
}

// "★ 4,5" si ya lo habéis puntuado
function textoMedia(d, receta) {
  const m = d.medias.get(receta.id);
  return m != null ? `★ ${formatoMedia(m)}` : null;
}

function TarjetaGrande({ comida, receta }) {
  const d = useDatos();
  if (!receta) return <HuecoVacio comida={comida} />;
  return (
    <article className="tarjeta">
      <a className="tarjeta-enlace" href={`#/plato/${comida.id}`}>
        <Portada receta={receta} forma="tarjeta" />
        <span className="tarjeta-textos">
          <span className="momento">{NOMBRE_TIPO[comida.tipo]}</span>
          <span className="tarjeta-titulo">{receta.titulo}</span>
          <span className="meta">
            {[tiempo(receta.tiempo_min), origen(receta), receta.capricho ? 'capricho' : null, textoMedia(d, receta)].filter(Boolean).join(' · ')}
          </span>
          <Conflictos receta={receta} />
        </span>
      </a>
      <a className="boton-flotante" href={`#/cambiar/${comida.id}`} aria-label={`Cambiar ${NOMBRE_TIPO[comida.tipo].toLowerCase()}`}>
        <Icono n="cambiar" />
      </a>
    </article>
  );
}

function FilaComida({ comida, receta }) {
  const d = useDatos();
  if (!receta) return <HuecoVacio comida={comida} />;
  return (
    <article className="fila-comida">
      <a className="fila-enlace" href={`#/plato/${comida.id}`}>
        <Portada receta={receta} forma="fila" />
        <span className="fila-textos">
          <span className="momento">
            {NOMBRE_TIPO[comida.tipo]} · {origen(receta)}
            {receta.capricho ? ' · capricho' : ''}
          </span>
          <span className="fila-titulo">{receta.titulo}</span>
          <span className="meta">{[tiempo(receta.tiempo_min), textoMedia(d, receta)].filter(Boolean).join(' · ')}</span>
          <Conflictos receta={receta} />
        </span>
      </a>
      <a className="boton-flotante" href={`#/cambiar/${comida.id}`} aria-label={`Cambiar ${NOMBRE_TIPO[comida.tipo].toLowerCase()}`}>
        <Icono n="cambiar" />
      </a>
    </article>
  );
}

function Preparar({ d, hoy, alPreparar }) {
  const [trabajando, setTrabajando] = useState(false);
  const orden = ordenarMenus(d.menus);
  const ultimo = orden[orden.length - 1];
  const inicio = siguienteInicio(orden, d.hogar.dia_compra, hoy, ultimo ? finDelMenu(ultimo, d.comidas) : null);
  const primera = !ultimo;
  return (
    <section className="preparar">
      <h3>{primera ? 'Preparad vuestra primera semana' : 'Toca preparar la semana siguiente'}</h3>
      <p>
        Os propongo los platos de la semana con vuestras reglas y se monta la lista de la compra. Después podéis cambiar lo que queráis.
      </p>
      <button
        className="boton lima"
        type="button"
        disabled={trabajando || !d.enLinea}
        onClick={async () => {
          setTrabajando(true);
          try {
            const f = await d.acciones.prepararSemana();
            alPreparar(f);
            d.avisar('Semana lista. La lista de la compra ya está hecha.');
          } catch (e) {
            console.error(e);
            d.avisar('No se ha podido preparar la semana. Prueba otra vez.', 'error');
          } finally {
            setTrabajando(false);
          }
        }}
      >
        {trabajando ? 'Preparando…' : inicio === hoy ? 'Preparar desde hoy' : `Preparar desde el ${etiquetaDia(inicio).toLowerCase()}`}
      </button>
    </section>
  );
}

function Rehacer({ d, menu }) {
  const [paso, setPaso] = useState(0);
  if (paso === 2) return <span className="meta">Proponiendo otra semana…</span>;
  return (
    <button
      type="button"
      className="boton-texto gris"
      disabled={!d.enLinea}
      onClick={async () => {
        if (paso === 0) {
          setPaso(1);
          setTimeout(() => setPaso((p) => (p === 1 ? 0 : p)), 4000);
          return;
        }
        setPaso(2);
        try {
          await d.acciones.rehacerSemana(menu);
          d.avisar('Otra propuesta lista.');
        } catch (e) {
          console.error(e);
          d.avisar('No se ha podido rehacer la semana.', 'error');
        }
        setPaso(0);
      }}
    >
      <Icono n="cambiar" t={18} />
      {paso === 1 ? 'Toca otra vez para cambiar todos los platos' : 'Proponer otra semana entera'}
    </button>
  );
}

export default function Semana({ diaForzado, menuForzado }) {
  const d = useDatos();
  const hoy = hoyISO();
  const orden = ordenarMenus(d.menus);
  const porDefecto = menuDeHoy(d.menus, d.comidas, hoy);
  const [menuId, setMenuId] = useState(menuForzado || memoria.menuId || porDefecto?.id || null);
  const [dia, setDia] = useState(diaForzado || memoria.dia);
  const [pendiente, setPendiente] = useState(null);
  const [vista, setVista] = useState(leerVista);
  function cambiarVista(v) {
    setVista(v);
    try {
      localStorage.setItem('mesa-vista', v);
    } catch {
      /* sin almacenamiento */
    }
  }
  const verSemana = vista === 'semana' && !diaForzado;
  const menu = orden.find((m) => m.id === (menuForzado || menuId)) || porDefecto;
  const dias = diasDelMenu(menu, d.comidas);
  const diaVisto = dias.includes(diaForzado || dia) ? diaForzado || dia : dias.includes(hoy) ? hoy : dias[0];

  useEffect(() => {
    memoria.menuId = menu?.id ?? null;
    memoria.dia = diaVisto ?? null;
  });

  // Al preparar una semana nueva, se salta a ella en cuanto llega
  useEffect(() => {
    if (!pendiente) return;
    const nuevo = d.menus.find((m) => m.semana_inicio === pendiente);
    if (nuevo) {
      setMenuId(nuevo.id);
      setDia(nuevo.semana_inicio);
      setPendiente(null);
    }
  }, [pendiente, d.menus]);

  const i = menu ? orden.findIndex((m) => m.id === menu.id) : -1;
  const anterior = i > 0 ? orden[i - 1] : null;
  const siguiente = i >= 0 && i < orden.length - 1 ? orden[i + 1] : null;
  function irAMenu(m) {
    if (!m) return;
    setMenuId(m.id);
    const ds = diasDelMenu(m, d.comidas);
    setDia(ds.includes(hoy) ? hoy : ds[0]);
  }

  const comidasMenu = menu ? d.comidas.filter((c) => c.menu_id === menu.id) : [];
  const delDia = comidasMenu.filter((c) => c.fecha === diaVisto).sort((a, b) => TIPOS_ORDEN[a.tipo] - TIPOS_ORDEN[b.tipo]);
  const principal = delDia.find((c) => c.tipo === 'comida') || delDia.find((c) => c.tipo !== 'desayuno') || null;

  const recetasSemana = comidasMenu.filter((c) => c.tipo !== 'desayuno').map((c) => d.recetasMap.get(c.receta_id));
  const sinPescado = d.restricciones.some((r) => r.tipo === 'grupo' && r.valor === 'pescado' && esBloqueante(r));
  const chips = menu ? chipsSemana(contarSemana(recetasSemana), d.hogar?.reglas, sinPescado) : [];

  const manana = diaVisto ? sumarDias(diaVisto, 1) : null;
  const descongelar =
    menu && manana && dias.includes(manana)
      ? descongelarPara({ inicio: menu.semana_inicio, fecha: manana, comidas: comidasMenu, recetasMap: d.recetasMap, ingMap: d.ingMap })
      : [];
  const nombresDescongelar = [...new Set(descongelar.map((x) => minuscula(x.nombre)))];
  const tiposDescongelar = [...new Set(descongelar.map((x) => NOMBRE_TIPO[x.tipo].toLowerCase()))];

  const ultimo = orden[orden.length - 1];
  const finUltimo = ultimo ? finDelMenu(ultimo, d.comidas) : null;
  const tocaPreparar = !ultimo || finUltimo < hoy || (menu?.id === ultimo.id && diasEntre(hoy, finUltimo) <= 2);
  const esFutura = menu && dias[0] > hoy;
  const nadaMarcado = menu && !d.lista.some((x) => x.menu_id === menu.id && x.marcado);
  const otros = d.personas;

  return (
    <div className="app con-tabs">
      <section className="cabecera">
        <header className="cab-fila">
          <div className="cab-textos">
            {menu ? (
              <span className="cab-sub navegar-semanas">
                <button type="button" onClick={() => irAMenu(anterior)} disabled={!anterior} aria-label="Semana anterior">
                  <Icono n="izquierda" t={16} />
                </button>
                <span>
                  {fechaCorta(dias[0])} – {fechaCorta(dias[dias.length - 1])}
                </span>
                <button type="button" onClick={() => irAMenu(siguiente)} disabled={!siguiente} aria-label="Semana siguiente">
                  <Icono n="derecha" t={16} />
                </button>
              </span>
            ) : (
              <span className="cab-sub">Menú de la semana</span>
            )}
            <h1 className="cab-titulo">{tituloSemana(menu, dias, hoy, orden)}</h1>
          </div>
          <Avatares personas={otros} tam={34} borde="#1D3B2F" />
        </header>
        {menu ? (
          <div className="segmentado" role="group" aria-label="Cómo ver la semana">
            <button type="button" className={verSemana ? '' : 'on'} aria-pressed={!verSemana} onClick={() => cambiarVista('dia')}>
              Día a día
            </button>
            <button type="button" className={verSemana ? 'on' : ''} aria-pressed={verSemana} onClick={() => cambiarVista('semana')}>
              Semana entera
            </button>
          </div>
        ) : null}
        {menu && !verSemana ? (
          <nav className="dias" aria-label="Días de la semana" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
            {dias.map((f) => {
              const on = f === diaVisto;
              return (
                <button
                  key={f}
                  type="button"
                  className={`dia${on ? ' on' : ''}${f === hoy ? ' hoy' : ''}`}
                  aria-pressed={on}
                  aria-label={`${etiquetaDia(f)}${f === hoy ? ', hoy' : ''}`}
                  onClick={() => setDia(f)}
                >
                  <span className="letra">{DIAS_CORTOS[parseFecha(f).getDay()]}</span>
                  <span className="num">{parseFecha(f).getDate()}</span>
                </button>
              );
            })}
          </nav>
        ) : null}
      </section>

      <main className="cuerpo">
        <AvisoValorar />
        {menu && verSemana ? (
          <>
            <Tablero
              d={d}
              dias={dias}
              comidasMenu={comidasMenu}
              hoy={hoy}
              alElegirDia={(f) => {
                setDia(f);
                cambiarVista('dia');
              }}
            />
            <div className="chips" aria-label="Cómo va la semana">
              {chips.map((c) => (
                <span key={c.texto} className={`chip-b ${c.estado}`}>
                  {c.estado === 'ok' ? <Icono n="check" t={13} /> : null}
                  <span>{c.texto}</span>
                </span>
              ))}
            </div>
            {esFutura && nadaMarcado ? <Rehacer d={d} menu={menu} /> : null}
          </>
        ) : menu ? (
          <>
            <h2 className="titulo-dia">
              {etiquetaDia(diaVisto)}
              {diaVisto === hoy ? <small>hoy</small> : null}
            </h2>
            {delDia
              .filter((c) => c !== principal && c.tipo === 'desayuno')
              .map((c) => (
                <FilaComida key={c.id} comida={c} receta={d.recetasMap.get(c.receta_id)} />
              ))}
            {principal ? <TarjetaGrande comida={principal} receta={d.recetasMap.get(principal.receta_id)} /> : null}
            {delDia
              .filter((c) => c !== principal && c.tipo !== 'desayuno')
              .map((c) => (
                <FilaComida key={c.id} comida={c} receta={d.recetasMap.get(c.receta_id)} />
              ))}
            {!delDia.length ? <div className="vacio-suave">Este día no hay nada planificado.</div> : null}
            {nombresDescongelar.length ? (
              <div className="nota-dia">
                <Icono n="copo" t={18} />
                <span>
                  Esta noche, pasa del congelador a la nevera: {enumerar(nombresDescongelar)} (para la {enumerar(tiposDescongelar)} de mañana).
                </span>
              </div>
            ) : null}
            <div className="chips" aria-label="Cómo va la semana">
              {chips.map((c) => (
                <span key={c.texto} className={`chip-b ${c.estado}`}>
                  {c.estado === 'ok' ? <Icono n="check" t={13} /> : null}
                  <span>{c.texto}</span>
                </span>
              ))}
            </div>
            {esFutura && nadaMarcado ? <Rehacer d={d} menu={menu} /> : null}
          </>
        ) : (
          <div className="vacio-suave">Todavía no hay ninguna semana planificada.</div>
        )}
        {d.hogar && tocaPreparar && (!menu || menu.id === ultimo?.id) ? <Preparar d={d} hoy={hoy} alPreparar={setPendiente} /> : null}
      </main>
    </div>
  );
}
