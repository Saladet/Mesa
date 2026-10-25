// Todos los datos del hogar en un solo sitio: carga, tiempo real, caché sin conexión y acciones.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, esErrorDeRed, mensajeError } from './supabase.js';
import { construirLista, planActualizacion, claveManual } from './logic/lista.js';
import { generarSemana, siguienteInicio } from './logic/generar.js';
import { hoyISO, capital } from './logic/fechas.js';
import { normalizar } from './logic/reglas.js';
import { ordenarMenus, finDelMenu, diasDelMenu } from './logic/semanas.js';
import { resumenNotas, mediasDe, ponerValoracion, quitarValoracion, buscarValoracion } from './logic/valoraciones.js';

const Ctx = createContext(null);
export function useDatos() {
  return useContext(Ctx);
}

const CLAVE_CACHE = 'mesa-cache-v1';
const CLAVE_PENDIENTES = 'mesa-pendientes-v1';
export const CLAVE_INVITACION = 'mesa-invitacion';
const COLORES = ['#C9EE6B', '#E3EAE5', '#F4D35E', '#F6C9B8', '#BFDDF2', '#D9CCF2'];

function leer(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
}
function guardar(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sin espacio o modo privado: la app sigue funcionando sin caché */
  }
}

const VACIO = { hogar: null, personas: [], restricciones: [], ingredientes: [], recetas: [], menus: [], comidas: [], lista: [], importaciones: [], valoraciones: [] };

function mapasDe(d) {
  return {
    ingMap: new Map(d.ingredientes.map((i) => [i.id, i])),
    recetasMap: new Map(d.recetas.map((r) => [r.id, r])),
  };
}

function comprobar(r) {
  if (r.error) throw r.error;
  return r.data;
}

// Reduce la foto antes de subirla (más rápido y ocupa poco)
async function reducirImagen(archivo, max = 1400, calidad = 0.82) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    lienzo.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo preparar la foto'))), 'image/jpeg', calidad));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProveedorDatos({ children }) {
  const [sesion, setSesion] = useState(undefined); // undefined = comprobando
  const [datos, setDatos] = useState(VACIO);
  const [estado, setEstado] = useState('iniciando');
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [aviso, setAviso] = useState(null);
  const ref = useRef(datos);
  ref.current = datos;
  const ultimaCarga = useRef(0);
  const vinculado = useRef(false);
  const colas = useRef(new Map());
  const uid = sesion?.user?.id ?? null;
  const uidRef = useRef(uid);
  uidRef.current = uid;

  const avisar = useCallback((texto, tipo = 'ok') => setAviso({ texto, tipo, id: Date.now() }), []);
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), aviso.tipo === 'error' ? 4500 : 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  // ---- Sesión ----
  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setSesion(data.session ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s ?? null));
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // ---- Carga completa (los datos de un hogar son pocos) ----
  const cargar = useCallback(async () => {
    if (!uid) return null;
    try {
      const token = localStorage.getItem(CLAVE_INVITACION);
      if (token) {
        const r = await supabase.rpc('aceptar_invitacion', { p_token: token });
        if (!r.error) {
          localStorage.removeItem(CLAVE_INVITACION);
          if (r.data) avisar('Ya estás dentro. ¡Bienvenida a la mesa!');
          else avisar('Esa invitación ya se usó o no es válida.', 'error');
        }
      }
      if (!vinculado.current) {
        await supabase.rpc('vincular_persona');
        vinculado.current = true;
      }
      const [personas, hogar, restricciones, ingredientes, recetas, menusDesc, importaciones, valoraciones] = await Promise.all([
        supabase.from('personas').select('*').order('orden').then(comprobar),
        supabase.from('hogares').select('*').limit(1).maybeSingle().then(comprobar),
        supabase.from('restricciones').select('*').order('created_at').then(comprobar),
        supabase.from('ingredientes').select('*').then(comprobar),
        supabase.from('recetas').select('*, receta_ingredientes(*)').order('titulo').then(comprobar),
        supabase.from('menus').select('*').order('semana_inicio', { ascending: false }).limit(8).then(comprobar),
        supabase.from('importaciones').select('*').eq('estado', 'pendiente').order('created_at').then(comprobar),
        supabase.from('valoraciones').select('*').order('fecha', { ascending: false }).then(comprobar),
      ]);
      const menus = ordenarMenus(menusDesc);
      const ids = menus.map((m) => m.id);
      let comidas = [];
      let lista = [];
      if (ids.length) {
        [comidas, lista] = await Promise.all([
          supabase.from('menu_comidas').select('*').in('menu_id', ids).then(comprobar),
          supabase.from('lista_items').select('*').in('menu_id', ids).order('orden').then(comprobar),
        ]);
      }
      for (const r of recetas) (r.receta_ingredientes || []).sort((a, b) => a.orden - b.orden);
      const nuevos = { hogar, personas, restricciones, ingredientes, recetas, menus, comidas, lista, importaciones, valoraciones };
      if (uidRef.current !== uid) return null;
      setDatos(nuevos);
      guardar(CLAVE_CACHE, { uid, datos: nuevos });
      ultimaCarga.current = Date.now();
      setEnLinea(true);
      setEstado('listo');
      return nuevos;
    } catch (e) {
      console.error(e);
      if (esErrorDeRed(e)) setEnLinea(false);
      setEstado(ref.current.hogar ? 'listo' : 'error');
      return null;
    }
  }, [uid, avisar]);

  useEffect(() => {
    if (sesion === undefined) return;
    if (!uid) {
      setDatos(VACIO);
      setEstado('listo');
      return;
    }
    vinculado.current = false;
    const cache = leer(CLAVE_CACHE, null);
    if (cache?.uid === uid && cache.datos?.hogar) {
      setDatos({ ...VACIO, ...cache.datos });
      setEstado('listo');
    } else {
      setDatos(VACIO);
      setEstado('cargando');
    }
    cargar();
  }, [uid, sesion === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Tiempo real: lista y menú se ven a la vez en los dos móviles ----
  const hogarId = datos.hogar?.id;
  useEffect(() => {
    if (!uid || !hogarId) return undefined;
    let espera = null;
    const recargarLuego = () => {
      clearTimeout(espera);
      espera = setTimeout(() => cargar(), 700);
    };
    const aplicar = (clave) => (cambio) => {
      if (cambio.eventType === 'DELETE') {
        const id = cambio.old?.id;
        if (id) setDatos((d) => ({ ...d, [clave]: d[clave].filter((x) => x.id !== id) }));
        return;
      }
      const fila = cambio.new;
      if (!fila?.id) return;
      if (!ref.current.menus.some((m) => m.id === fila.menu_id)) {
        recargarLuego();
        return;
      }
      setDatos((d) => {
        const arr = d[clave];
        const i = arr.findIndex((x) => x.id === fila.id);
        if (i === -1) return { ...d, [clave]: [...arr, fila] };
        const copia = arr.slice();
        copia[i] = { ...arr[i], ...fila };
        return { ...d, [clave]: copia };
      });
    };
    // Lo que valora el otro aparece al momento
    const aplicarValoracion = (cambio) => {
      if (cambio.eventType === 'DELETE') {
        const id = cambio.old?.id;
        if (id) setDatos((d) => ({ ...d, valoraciones: d.valoraciones.filter((v) => v.id !== id) }));
        return;
      }
      const fila = cambio.new;
      if (!fila?.id || fila.hogar_id !== hogarId) return;
      setDatos((d) => {
        const actual = buscarValoracion(d.valoraciones, fila.receta_id, fila.persona_id, fila.fecha);
        if (actual && Date.parse(actual.updated_at) > Date.parse(fila.updated_at)) return d; // ya hay algo más nuevo
        return { ...d, valoraciones: ponerValoracion(d.valoraciones, fila) };
      });
    };
    const canal = supabase
      .channel(`mesa-${hogarId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_items' }, aplicar('lista'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_comidas' }, aplicar('comidas'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, recargarLuego)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recetas' }, recargarLuego)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'valoraciones' }, aplicarValoracion)
      .subscribe();
    return () => {
      clearTimeout(espera);
      supabase.removeChannel(canal);
    };
  }, [uid, hogarId, cargar]);

  // ---- Cambios hechos sin conexión (marcar en la lista) ----
  const vaciarPendientes = useCallback(async () => {
    const pendientes = leer(CLAVE_PENDIENTES, []);
    if (!pendientes.length) return;
    const quedan = [];
    for (const p of pendientes) {
      const r = await supabase.from('lista_items').update(p.cambios).eq('id', p.id);
      if (r.error && esErrorDeRed(r.error)) quedan.push(p);
    }
    guardar(CLAVE_PENDIENTES, quedan);
  }, []);

  function encolar(id, cambios) {
    const pendientes = leer(CLAVE_PENDIENTES, []).filter((p) => p.id !== id);
    pendientes.push({ id, cambios });
    guardar(CLAVE_PENDIENTES, pendientes);
  }

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && uid && Date.now() - ultimaCarga.current > 15000) {
        vaciarPendientes().then(cargar);
      }
    };
    const conRed = () => {
      setEnLinea(true);
      if (uid) vaciarPendientes().then(cargar);
    };
    const sinRed = () => setEnLinea(false);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', conRed);
    window.addEventListener('offline', sinRed);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', conRed);
      window.removeEventListener('offline', sinRed);
    };
  }, [uid, cargar, vaciarPendientes]);

  useEffect(() => {
    if (uid && navigator.onLine) vaciarPendientes();
  }, [uid, vaciarPendientes]);

  // ---- Derivados ----
  const mapas = useMemo(
    () => ({
      ingMap: new Map(datos.ingredientes.map((i) => [i.id, i])),
      recetasMap: new Map(datos.recetas.map((r) => [r.id, r])),
      personasMap: new Map(datos.personas.map((p) => [p.id, p])),
    }),
    [datos.ingredientes, datos.recetas, datos.personas],
  );
  const notas = useMemo(() => resumenNotas(datos.valoraciones), [datos.valoraciones]);
  const medias = useMemo(() => mediasDe(notas), [notas]);
  const yo = datos.personas.find((p) => p.user_id === uid) || null;
  const comensales = Math.max(1, datos.personas.length);

  function actualizarLocal(clave, id, cambios) {
    setDatos((d) => ({ ...d, [clave]: d[clave].map((x) => (x.id === id ? { ...x, ...cambios } : x)) }));
  }

  // ---- Lista de la compra ----
  async function regenerarLista(menu) {
    const d = ref.current;
    const [comidas, existentes] = await Promise.all([
      supabase.from('menu_comidas').select('*').eq('menu_id', menu.id).then(comprobar),
      supabase.from('lista_items').select('*').eq('menu_id', menu.id).then(comprobar),
    ]);
    const { ingMap, recetasMap } = mapasDe(d);
    const nuevas = construirLista({ inicio: menu.semana_inicio, comidas, recetasMap, ingMap, personas: Math.max(1, d.personas.length) });
    const plan = planActualizacion(nuevas, existentes);
    const porId = new Map(existentes.map((e) => [e.id, e]));
    const borrar = plan.borrar.filter((id) => !porId.get(id)?.marcado);
    if (borrar.length) comprobar(await supabase.from('lista_items').delete().in('id', borrar));
    if (plan.actualizar.length) {
      const filas = plan.actualizar.map((a) => ({ ...a, menu_id: menu.id, clave: porId.get(a.id).clave }));
      comprobar(await supabase.from('lista_items').upsert(filas, { onConflict: 'menu_id,clave' }));
    }
    if (plan.insertar.length) {
      const filas = plan.insertar.map((n) => ({ ...n, menu_id: menu.id }));
      comprobar(await supabase.from('lista_items').upsert(filas, { onConflict: 'menu_id,clave', ignoreDuplicates: true }));
    }
    const lista = comprobar(await supabase.from('lista_items').select('*').eq('menu_id', menu.id).order('orden'));
    setDatos((x) => ({ ...x, lista: [...x.lista.filter((i) => i.menu_id !== menu.id), ...lista] }));
  }

  async function marcarItem(item, marcado) {
    const cambios = marcado
      ? { marcado: true, marcado_por: yo?.id ?? null, marcado_at: new Date().toISOString() }
      : { marcado: false, marcado_por: null, marcado_at: null };
    actualizarLocal('lista', item.id, cambios);
    const r = await supabase.from('lista_items').update(cambios).eq('id', item.id);
    if (r.error) {
      if (esErrorDeRed(r.error)) encolar(item.id, cambios);
      else avisar(mensajeError(r.error), 'error');
    }
  }

  async function ponerEnCasa(item, valor) {
    const cambios = { en_casa: valor };
    actualizarLocal('lista', item.id, cambios);
    const r = await supabase.from('lista_items').update(cambios).eq('id', item.id);
    if (r.error) {
      if (esErrorDeRed(r.error)) encolar(item.id, cambios);
      else avisar(mensajeError(r.error), 'error');
    }
  }

  async function anadirALista(menu, texto) {
    const nombre = capital(texto.trim().replace(/\s+/g, ' '));
    if (!nombre) return false;
    const d = ref.current;
    const n = normalizar(nombre);
    const ing = d.ingredientes.find((i) => normalizar(i.nombre) === n || i.id === n.replace(/ /g, '-'));
    const fila = {
      menu_id: menu.id,
      clave: claveManual(nombre),
      nombre,
      ingrediente_id: ing?.id ?? null,
      seccion: ing?.seccion ?? 'Otros',
      manual: true,
      orden: 900,
    };
    const r = await supabase.from('lista_items').insert(fila).select().single();
    if (r.error) {
      avisar(r.error.code === '23505' ? 'Eso ya está en la lista.' : mensajeError(r.error), 'error');
      return false;
    }
    setDatos((x) => (x.lista.some((i) => i.id === r.data.id) ? x : { ...x, lista: [...x.lista, r.data] }));
    return true;
  }

  async function quitarDeLista(item) {
    setDatos((x) => ({ ...x, lista: x.lista.filter((i) => i.id !== item.id) }));
    const r = await supabase.from('lista_items').delete().eq('id', item.id);
    if (r.error) {
      avisar(mensajeError(r.error), 'error');
      cargar();
    }
  }

  // ---- Menú ----
  async function cambiarComida(comida, recetaId) {
    actualizarLocal('comidas', comida.id, { receta_id: recetaId });
    const r = await supabase.from('menu_comidas').update({ receta_id: recetaId }).eq('id', comida.id);
    if (r.error) {
      avisar(mensajeError(r.error), 'error');
      cargar();
      return false;
    }
    const menu = ref.current.menus.find((m) => m.id === comida.menu_id);
    try {
      if (menu) await regenerarLista(menu);
    } catch (e) {
      console.error(e);
      avisar('El plato está cambiado, pero la lista no se ha podido actualizar. Abre la app otra vez con conexión.', 'error');
    }
    return true;
  }

  async function prepararSemana() {
    const d = ref.current;
    const hoy = hoyISO();
    const { ingMap } = mapasDe(d);
    const orden = ordenarMenus(d.menus);
    const ultimo = orden[orden.length - 1] || null;
    const ultimoDia = ultimo ? finDelMenu(ultimo, d.comidas) : null;
    const inicio = siguienteInicio(orden, d.hogar.dia_compra, hoy, ultimoDia);
    const recientes = new Set(d.comidas.filter((c) => c.menu_id === ultimo?.id).map((c) => c.receta_id));
    const huecos = generarSemana({
      inicio,
      recetas: d.recetas,
      ingMap,
      restricciones: d.restricciones,
      reglas: d.hogar.reglas,
      momentos: d.hogar.comidas,
      recientes,
      medias: mediasDe(resumenNotas(d.valoraciones)),
      semilla: Date.now(),
    });
    const r = await supabase.from('menus').insert({ hogar_id: d.hogar.id, semana_inicio: inicio }).select().single();
    if (r.error) {
      if (r.error.code === '23505') {
        await cargar();
        return inicio;
      }
      throw r.error;
    }
    const menu = r.data;
    comprobar(await supabase.from('menu_comidas').insert(huecos.map((h) => ({ ...h, menu_id: menu.id }))));
    // Si la semana anterior se solapa con la nueva, se acorta
    const solapadas = ultimo ? d.comidas.filter((c) => c.menu_id === ultimo.id && c.fecha >= inicio) : [];
    if (solapadas.length) {
      comprobar(await supabase.from('menu_comidas').delete().in('id', solapadas.map((c) => c.id)));
      await regenerarLista(ultimo);
    }
    await regenerarLista(menu);
    await cargar();
    return inicio;
  }

  async function rehacerSemana(menu) {
    const d = ref.current;
    const { ingMap } = mapasDe(d);
    const dias = new Set(diasDelMenu(menu, d.comidas));
    const anteriores = ordenarMenus(d.menus).filter((m) => m.semana_inicio < menu.semana_inicio);
    const previo = anteriores[anteriores.length - 1];
    const recientes = new Set(d.comidas.filter((c) => c.menu_id === menu.id || c.menu_id === previo?.id).map((c) => c.receta_id));
    const huecos = generarSemana({
      inicio: menu.semana_inicio,
      recetas: d.recetas,
      ingMap,
      restricciones: d.restricciones,
      reglas: d.hogar.reglas,
      momentos: d.hogar.comidas,
      recientes,
      medias: mediasDe(resumenNotas(d.valoraciones)),
      semilla: Date.now(),
    }).filter((h) => dias.has(h.fecha));
    comprobar(await supabase.from('menu_comidas').delete().eq('menu_id', menu.id));
    comprobar(await supabase.from('menu_comidas').insert(huecos.map((h) => ({ ...h, menu_id: menu.id }))));
    await regenerarLista(menu);
    await cargar();
  }

  // ---- Recetas ----
  async function subirFoto(receta, archivo) {
    const d = ref.current;
    const blob = await reducirImagen(archivo);
    const ruta = `${d.hogar.id}/${receta.id}-${Date.now()}.jpg`;
    comprobar(await supabase.storage.from('fotos').upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
    const url = supabase.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
    comprobar(await supabase.from('recetas').update({ foto_url: url }).eq('id', receta.id));
    const prefijo = '/storage/v1/object/public/fotos/';
    if (receta.foto_url && receta.foto_url.includes(prefijo)) {
      const vieja = decodeURIComponent(receta.foto_url.split(prefijo)[1]);
      supabase.storage.from('fotos').remove([vieja]);
    }
    actualizarLocal('recetas', receta.id, { foto_url: url });
  }

  async function marcarCocinada(receta) {
    const veces = (receta.veces_cocinada || 0) + 1;
    actualizarLocal('recetas', receta.id, { veces_cocinada: veces });
    await supabase.from('recetas').update({ veces_cocinada: veces }).eq('id', receta.id);
  }

  // Guarda la puntuación y/o el comentario de una persona sobre el plato de un día.
  // Sin puntuación ni comentario, la valoración se borra.
  // Se ve al momento en pantalla; en la base de datos se guardan en orden (por si se toca dos veces seguidas)
  function valorar({ receta, persona, fecha, puntuacion, comentario }) {
    const d = ref.current;
    const existente = buscarValoracion(d.valoraciones, receta.id, persona.id, fecha);
    const nota = puntuacion !== undefined ? puntuacion : existente?.puntuacion ?? null;
    const texto = (comentario !== undefined ? comentario : existente?.comentario ?? '').trim() || null;
    const filtro = { receta_id: receta.id, persona_id: persona.id, fecha };
    const k = `${receta.id}|${persona.id}|${fecha}`;
    const ahora = new Date().toISOString();

    if (!nota && !texto) {
      if (!existente) return Promise.resolve(null);
      setDatos((x) => ({ ...x, valoraciones: quitarValoracion(x.valoraciones, existente) }));
      return enCola(k, async () => {
        const r = await supabase.from('valoraciones').delete().match(filtro);
        if (r.error) {
          setDatos((x) => ({ ...x, valoraciones: ponerValoracion(x.valoraciones, existente) }));
          throw r.error;
        }
        return null;
      });
    }

    const fila = { hogar_id: d.hogar.id, ...filtro, puntuacion: nota, comentario: texto, updated_at: ahora };
    const provisional = existente ? { ...existente, ...fila } : { id: `nueva-${Date.now()}`, created_at: ahora, ...fila };
    setDatos((x) => ({ ...x, valoraciones: ponerValoracion(x.valoraciones, provisional) }));
    return enCola(k, async () => {
      const r = await supabase.from('valoraciones').upsert(fila, { onConflict: 'receta_id,persona_id,fecha' }).select().single();
      const esLaUltima = (x) => {
        const actual = buscarValoracion(x.valoraciones, receta.id, persona.id, fecha);
        return !actual || Date.parse(actual.updated_at) <= Date.parse(ahora);
      };
      if (r.error) {
        setDatos((x) =>
          esLaUltima(x)
            ? { ...x, valoraciones: existente ? ponerValoracion(x.valoraciones, existente) : quitarValoracion(x.valoraciones, provisional) }
            : x,
        );
        throw r.error;
      }
      setDatos((x) => (esLaUltima(x) ? { ...x, valoraciones: ponerValoracion(x.valoraciones, r.data) } : x));
      return r.data;
    });
  }

  function enCola(k, tarea) {
    const previa = colas.current.get(k) || Promise.resolve();
    const siguiente = previa.catch(() => {}).then(tarea);
    colas.current.set(k, siguiente);
    siguiente.finally(() => {
      if (colas.current.get(k) === siguiente) colas.current.delete(k);
    }).catch(() => {});
    return siguiente;
  }

  async function importarEnlace(url) {
    const d = ref.current;
    const r = await supabase.from('importaciones').insert({ hogar_id: d.hogar.id, url, creada_por: yo?.id ?? null }).select().single();
    if (r.error) throw r.error;
    setDatos((x) => ({ ...x, importaciones: [...x.importaciones, r.data] }));
  }

  // ---- Hogar ----
  async function actualizarHogar(cambios) {
    const d = ref.current;
    setDatos((x) => ({ ...x, hogar: { ...x.hogar, ...cambios } }));
    const r = await supabase.from('hogares').update(cambios).eq('id', d.hogar.id);
    if (r.error) {
      avisar(mensajeError(r.error), 'error');
      cargar();
    }
  }

  async function anadirRestriccion(persona, interpretada) {
    if (interpretada.nuevo) {
      const r = await supabase
        .from('ingredientes')
        .upsert({ id: interpretada.valor, nombre: interpretada.nombre, grupos: [] }, { onConflict: 'id', ignoreDuplicates: true });
      if (r.error) throw r.error;
      setDatos((x) =>
        x.ingredientes.some((i) => i.id === interpretada.valor)
          ? x
          : { ...x, ingredientes: [...x.ingredientes, { id: interpretada.valor, nombre: interpretada.nombre, grupos: [], seccion: null, dias_nevera: null }] },
      );
    }
    const r = await supabase
      .from('restricciones')
      .insert({ persona_id: persona.id, tipo: interpretada.tipo, valor: interpretada.valor, nivel: interpretada.nivel, nota: interpretada.nota || null })
      .select()
      .single();
    if (r.error) throw r.error;
    setDatos((x) => ({ ...x, restricciones: [...x.restricciones, r.data] }));
  }

  async function quitarRestriccion(restriccion) {
    setDatos((x) => ({ ...x, restricciones: x.restricciones.filter((r) => r.id !== restriccion.id) }));
    const r = await supabase.from('restricciones').delete().eq('id', restriccion.id);
    if (r.error) {
      avisar(mensajeError(r.error), 'error');
      cargar();
    }
  }

  async function anadirPersona(nombre) {
    const d = ref.current;
    const limpio = capital(nombre.trim());
    if (!limpio) return;
    const usados = new Set(d.personas.map((p) => p.color));
    const color = COLORES.find((c) => !usados.has(c)) || COLORES[d.personas.length % COLORES.length];
    const orden = d.personas.reduce((m, p) => Math.max(m, p.orden || 0), 0) + 1;
    const r = await supabase.from('personas').insert({ hogar_id: d.hogar.id, nombre: limpio, color, orden }).select().single();
    if (r.error) throw r.error;
    setDatos((x) => ({ ...x, personas: [...x.personas, r.data] }));
  }

  async function quitarPersona(persona) {
    setDatos((x) => ({
      ...x,
      personas: x.personas.filter((p) => p.id !== persona.id),
      restricciones: x.restricciones.filter((r) => r.persona_id !== persona.id),
    }));
    const r = await supabase.from('personas').delete().eq('id', persona.id);
    if (r.error) {
      avisar(mensajeError(r.error), 'error');
      cargar();
    }
  }

  async function invitar(persona) {
    let token = persona.invitacion;
    if (!token) {
      token = crypto.randomUUID();
      comprobar(await supabase.from('personas').update({ invitacion: token }).eq('id', persona.id));
      actualizarLocal('personas', persona.id, { invitacion: token });
    }
    return `${window.location.origin}${window.location.pathname}#/unirse/${token}`;
  }

  // ---- Cuenta ----
  async function entrar(email, clave) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    if (error) throw error;
  }

  async function crearCuenta(email, clave) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: clave,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    if (error) throw error;
    return { necesitaConfirmar: !data.session };
  }

  async function salir() {
    try {
      localStorage.removeItem(CLAVE_CACHE);
      localStorage.removeItem(CLAVE_PENDIENTES);
    } catch {
      /* nada */
    }
    await supabase.auth.signOut();
  }

  const valor = {
    estado,
    sesion,
    uid,
    yo,
    enLinea,
    aviso,
    avisar,
    comensales,
    ...datos,
    ...mapas,
    notas,
    medias,
    recargar: cargar,
    acciones: {
      marcarItem,
      ponerEnCasa,
      anadirALista,
      quitarDeLista,
      cambiarComida,
      prepararSemana,
      rehacerSemana,
      regenerarLista,
      subirFoto,
      marcarCocinada,
      valorar,
      importarEnlace,
      actualizarHogar,
      anadirRestriccion,
      quitarRestriccion,
      anadirPersona,
      quitarPersona,
      invitar,
      entrar,
      crearCuenta,
      salir,
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
