// Genera el SQL de carga inicial (catálogo, recetas, primera semana y su lista) en tres partes.
// Uso: node seed/sql.mjs <hogar_id> <carpeta_salida>
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INGREDIENTES, RECETAS, SEMANA } from './datos.js';
import { construirLista } from '../src/logic/lista.js';

const [hogarId, salida] = process.argv.slice(2);
if (!hogarId || !salida) {
  console.error('Uso: node seed/sql.mjs <hogar_id> <carpeta_salida>');
  process.exit(1);
}

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a && a.length ? `array[${a.map(q).join(',')}]::text[]` : `'{}'::text[]`);
const json = (o) => `${q(JSON.stringify(o))}::jsonb`;
const num = (n) => (n == null ? 'null' : String(n));

const ingMap = new Map(INGREDIENTES.map(([id, nombre, grupos, seccion, dias]) => [id, { id, nombre, grupos, seccion, dias_nevera: dias }]));

const errores = [];
for (const r of RECETAS) {
  const ids = new Set(r.ing.map((i) => i[0]));
  for (const [id] of r.ing) if (!ingMap.has(id)) errores.push(`${r.slug}: ingrediente desconocido ${id}`);
  for (const [, , pasoIngs] of r.pasos) for (const id of pasoIngs) if (!ids.has(id)) errores.push(`${r.slug}: el paso usa ${id} que no está en la receta`);
  for (const [texto] of r.pasos) if (!/\*\*.+\*\*/.test(texto)) errores.push(`${r.slug}: paso sin resaltado: ${texto}`);
}
if (errores.length) {
  console.error(errores.join('\n'));
  process.exit(1);
}

const recetas = RECETAS.map((r) => {
  const id = randomUUID();
  return {
    id,
    slug: r.slug,
    titulo: r.titulo,
    tiempo_min: r.tiempo,
    pasos: r.pasos.map(([texto, min, ingredientes]) => ({ texto, min: min || null, ingredientes })),
    paleta: r.paleta,
    momentos: r.momentos,
    proteina: r.proteina,
    capricho: !!r.capricho,
    raciones: 2,
    receta_ingredientes: r.ing.map(([ingId, cantidad, unidad, texto], i) => ({
      receta_id: id,
      ingrediente_id: ingId,
      texto_propio: texto || null,
      texto_original: texto || ingMap.get(ingId).nombre,
      cantidad,
      unidad,
      orden: i,
    })),
  };
});
const porSlug = new Map(recetas.map((r) => [r.slug, r]));
const recetasMap = new Map(recetas.map((r) => [r.id, r]));

const comidas = [];
for (const [fecha, comida, cena] of SEMANA.dias) {
  comidas.push({ fecha, tipo: 'comida', receta_id: porSlug.get(comida).id, slug: comida });
  comidas.push({ fecha, tipo: 'cena', receta_id: porSlug.get(cena).id, slug: cena });
}
const lista = construirLista({ inicio: SEMANA.inicio, comidas, recetasMap, ingMap, personas: 2 });

// Parte 1: catálogo
const p1 =
  'insert into public.ingredientes (id, nombre, grupos, seccion, dias_nevera) values\n' +
  INGREDIENTES.map(([id, nombre, grupos, seccion, dias]) => `(${q(id)},${q(nombre)},${arr(grupos)},${q(seccion)},${num(dias)})`).join(',\n') +
  '\non conflict (id) do update set nombre = excluded.nombre, grupos = excluded.grupos, seccion = excluded.seccion, dias_nevera = excluded.dias_nevera;\n';

// Parte 2: recetas e ingredientes de cada receta
const mapa = `(values ${recetas.map((r) => `(${q(r.slug)},${q(r.id)}::uuid)`).join(',')}) as r(slug, id)`;
const p2 =
  'insert into public.recetas (id, hogar_id, titulo, origen, tiempo_min, raciones, pasos, paleta, momentos, proteina, capricho) values\n' +
  recetas
    .map((r) => `(${q(r.id)},${q(hogarId)},${q(r.titulo)},'nueva',${num(r.tiempo_min)},2,${json(r.pasos)},${json(r.paleta)},${arr(r.momentos)},${q(r.proteina)},${r.capricho})`)
    .join(',\n') +
  ';\n\n' +
  'insert into public.receta_ingredientes (receta_id, ingrediente_id, texto_original, cantidad, unidad, orden)\n' +
  'select r.id, v.i, coalesce(v.t, ing.nombre), v.c, v.u, v.o\nfrom (values\n' +
  recetas
    .flatMap((r) => r.receta_ingredientes.map((ri) => ({ ...ri, slug: r.slug })))
    .map((ri, k) => (k === 0
      ? `(${q(ri.slug)}::text,${q(ri.ingrediente_id)}::text,${q(ri.texto_propio)}::text,${num(ri.cantidad)}::numeric,${q(ri.unidad)}::text,${ri.orden}::smallint)`
      : `(${q(ri.slug)},${q(ri.ingrediente_id)},${q(ri.texto_propio)},${num(ri.cantidad)},${q(ri.unidad)},${ri.orden})`))
    .join(',\n') +
  `\n) as v(s, i, t, c, u, o)\njoin ${mapa} on r.slug = v.s\njoin public.ingredientes ing on ing.id = v.i;\n`;

// Parte 3: primera semana y su lista
const p3 =
  `with m as (insert into public.menus (hogar_id, semana_inicio) values (${q(hogarId)}, ${q(SEMANA.inicio)}) returning id),\n` +
  `c as (insert into public.menu_comidas (menu_id, fecha, tipo, receta_id)\n  select m.id, v.f::date, v.t, r.id from m, (values ${comidas.map((c) => `(${q(c.fecha)},${q(c.tipo)},${q(c.slug)})`).join(',')}) as v(f, t, s)\n  join ${mapa} on r.slug = v.s returning 1)\n` +
  'insert into public.lista_items (menu_id, clave, ingrediente_id, nombre, cantidad, seccion, nota, congelar, en_casa, orden)\n' +
  'select m.id, v.k, v.i, v.n, v.c, v.s, v.nt, v.cg, v.ec, v.o from m, (values\n' +
  lista
    .map((l, k) => (k === 0
      ? `(${q(l.clave)}::text,${q(l.ingrediente_id)}::text,${q(l.nombre)}::text,${q(l.cantidad)}::text,${q(l.seccion)}::text,${q(l.nota)}::text,${l.congelar},${l.en_casa},${l.orden}::smallint)`
      : `(${q(l.clave)},${q(l.ingrediente_id)},${q(l.nombre)},${q(l.cantidad)},${q(l.seccion)},${q(l.nota)},${l.congelar},${l.en_casa},${l.orden})`))
    .join(',\n') +
  '\n) as v(k, i, n, c, s, nt, cg, ec, o);\n';

writeFileSync(join(salida, 'seed-1.sql'), p1);
writeFileSync(join(salida, 'seed-2.sql'), p2);
writeFileSync(join(salida, 'seed-3.sql'), p3);
console.log(`Recetas: ${recetas.length} · ingredientes de recetas: ${recetas.reduce((n, r) => n + r.receta_ingredientes.length, 0)} · catálogo: ${INGREDIENTES.length} · lista: ${lista.length}`);
console.log(`Tamaños: ${p1.length} / ${p2.length} / ${p3.length}`);
