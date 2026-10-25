// Lista de la compra a partir del menú de la semana.
import { cantidadCompra } from './cantidades.js';
import { diasEntre, nombreDia, listaDias } from './fechas.js';
import { normalizar } from './reglas.js';

export const SECCIONES = [
  'Frutería y verdura',
  'Carnicería',
  'Pescadería',
  'Lácteos y huevos',
  'Panadería',
  'Despensa',
  'Congelados',
  'Especias y básicos',
  'Otros',
];

export function ordenSeccion(s) {
  const i = SECCIONES.indexOf(s);
  return i === -1 ? SECCIONES.length : i;
}

export function claveItem(item) {
  return item.clave || item.ingrediente_id || `txt:${normalizar(item.nombre)}`;
}

export function claveManual(nombre) {
  return `manual:${normalizar(nombre)}`;
}

function unico(arr) {
  return [...new Set(arr)];
}

/**
 * comidas: [{ fecha, receta_id }] del menú
 * recetasMap: Map id -> receta (con receta_ingredientes)
 * ingMap: Map id -> ingrediente
 * factor: personas / raciones
 */
export function construirLista({ inicio, comidas, recetasMap, ingMap, personas = 2 }) {
  const items = new Map();
  for (const comida of comidas) {
    if (!comida.receta_id) continue;
    const receta = recetasMap.get(comida.receta_id);
    if (!receta) continue;
    const factor = personas / (receta.raciones || 2);
    const desfase = diasEntre(inicio, comida.fecha);
    for (const ri of receta.receta_ingredientes || []) {
      const ing = ri.ingrediente_id ? ingMap.get(ri.ingrediente_id) : null;
      const clave = ing ? ing.id : `txt:${normalizar(ri.texto_original)}`;
      let a = items.get(clave);
      if (!a) {
        a = {
          clave,
          ingrediente_id: ing ? ing.id : null,
          nombre: ing ? ing.nombre : ri.texto_original,
          seccion: (ing && ing.seccion) || 'Otros',
          grupos: (ing && ing.grupos) || [],
          dias: ing ? ing.dias_nevera : null,
          cantidades: new Map(),
          recetas: new Set(),
          usos: [],
        };
        items.set(clave, a);
      }
      const unidad = ri.unidad || 'ud';
      if (ri.cantidad != null) {
        a.cantidades.set(unidad, (a.cantidades.get(unidad) || 0) + Number(ri.cantidad) * factor);
      }
      a.recetas.add(receta.id);
      a.usos.push({ desfase, fecha: comida.fecha });
    }
  }

  const filas = [];
  for (const a of items.values()) {
    const partes = [];
    for (const [unidad, q] of a.cantidades) {
      const t = cantidadCompra(q, unidad);
      if (t) partes.push(t);
    }
    const basico = a.grupos.includes('basico');
    const congelable = a.grupos.includes('carne') || a.grupos.includes('pescado');
    let congelar = false;
    let nota = null;
    if (a.dias != null && !basico) {
      const tarde = a.usos.filter((u) => u.desfase > a.dias);
      if (tarde.length) {
        const dias = unico(tarde.sort((x, y) => x.desfase - y.desfase).map((u) => nombreDia(u.fecha)));
        if (congelable) {
          congelar = true;
          nota = tarde.length === a.usos.length
            ? `Para ${listaDias(dias)}`
            : `Congela solo lo ${listaDias(dias, 'del')}`;
        } else {
          nota = `Aguanta poco: lo ${listaDias(dias, 'del')}, mejor cómpralo más tarde`;
        }
      }
    }
    if (!nota && !basico && a.recetas.size > 1) nota = `Para ${a.recetas.size} recetas`;
    filas.push({
      clave: a.clave,
      ingrediente_id: a.ingrediente_id,
      nombre: a.nombre,
      cantidad: partes.join(' + ') || null,
      seccion: a.seccion,
      nota,
      congelar,
      en_casa: basico,
    });
  }
  filas.sort((x, y) => ordenSeccion(x.seccion) - ordenSeccion(y.seccion) || x.nombre.localeCompare(y.nombre, 'es'));
  filas.forEach((f, i) => { f.orden = i; });
  return filas;
}

/**
 * Compara la lista nueva con la que hay guardada y dice qué cambiar.
 * Conserva lo marcado y lo que ya está en casa; no toca lo añadido a mano.
 */
export function planActualizacion(nuevas, existentes) {
  const porClave = new Map();
  for (const e of existentes) {
    if (!e.manual) porClave.set(claveItem(e), e);
  }
  const actualizar = [];
  const insertar = [];
  for (const n of nuevas) {
    const e = porClave.get(n.clave);
    const datos = {
      ingrediente_id: n.ingrediente_id,
      nombre: n.nombre,
      cantidad: n.cantidad,
      seccion: n.seccion,
      nota: n.nota,
      congelar: n.congelar,
      orden: n.orden,
    };
    if (e) {
      porClave.delete(n.clave);
      const cambia = ['nombre', 'cantidad', 'seccion', 'nota', 'congelar', 'orden'].some((k) => (e[k] ?? null) !== (datos[k] ?? null));
      if (cambia) actualizar.push({ id: e.id, ...datos });
    } else {
      insertar.push({ clave: n.clave, ...datos, en_casa: n.en_casa });
    }
  }
  const borrar = [...porClave.values()].map((e) => e.id);
  return { actualizar, insertar, borrar };
}

// Avisos de "saca del congelador": para cada fecha, lo que hay que descongelar la noche antes
export function descongelarPara({ inicio, fecha, comidas, recetasMap, ingMap }) {
  const out = [];
  for (const c of comidas) {
    if (c.fecha !== fecha || !c.receta_id) continue;
    const receta = recetasMap.get(c.receta_id);
    if (!receta) continue;
    const desfase = diasEntre(inicio, c.fecha);
    for (const ri of receta.receta_ingredientes || []) {
      const ing = ri.ingrediente_id ? ingMap.get(ri.ingrediente_id) : null;
      if (!ing || ing.dias_nevera == null) continue;
      const congelable = (ing.grupos || []).includes('carne') || (ing.grupos || []).includes('pescado');
      if (congelable && desfase > ing.dias_nevera) out.push({ nombre: ing.nombre, tipo: c.tipo });
    }
  }
  return out;
}
