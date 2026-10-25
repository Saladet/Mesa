// SQL para añadir un conjunto de recetas (y los ingredientes nuevos del catálogo).
// Uso: node seed/sql-recetas.mjs <importadas|especiales> <hogar_id> <carpeta_salida>
// Escribe <conjunto>-1.sql (ingredientes) y <conjunto>-2.sql (recetas e ingredientes de cada receta).
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INGREDIENTES } from './datos.js';
import * as importadas from './importadas.js';
import * as especiales from './especiales.js';

const [conjunto, hogarId, salida] = process.argv.slice(2);
const CONJUNTOS = {
  importadas: { nuevos: importadas.INGREDIENTES_NUEVOS, recetas: importadas.IMPORTADAS },
  especiales: { nuevos: especiales.INGREDIENTES_NUEVOS, recetas: especiales.ESPECIALES.map((r) => ({ ...r, especial: true })) },
};
if (!CONJUNTOS[conjunto] || !hogarId || !salida) {
  console.error('Uso: node seed/sql-recetas.mjs <importadas|especiales> <hogar_id> <carpeta_salida>');
  process.exit(1);
}
const { nuevos: INGREDIENTES_NUEVOS, recetas: RECETAS } = CONJUNTOS[conjunto];
const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a && a.length ? `array[${a.map(q).join(',')}]::text[]` : `'{}'::text[]`);
const json = (o) => `${q(JSON.stringify(o))}::jsonb`;
const num = (n) => (n == null ? 'null' : String(n));

const catalogo = new Map([...INGREDIENTES, ...importadas.INGREDIENTES_NUEVOS, ...especiales.INGREDIENTES_NUEVOS].map(([id, nombre]) => [id, nombre]));
const errores = [];
const slugs = new Set();
for (const r of RECETAS) {
  if (slugs.has(r.slug)) errores.push(`slug repetido ${r.slug}`);
  slugs.add(r.slug);
  const ids = new Set(r.ing.map((i) => i[0]));
  if (ids.size !== r.ing.length) errores.push(`${r.slug}: ingrediente repetido`);
  for (const [id] of r.ing) if (!catalogo.has(id)) errores.push(`${r.slug}: ingrediente desconocido ${id}`);
  for (const [texto, , pasoIngs] of r.pasos) {
    if (!/\*\*.+\*\*/.test(texto)) errores.push(`${r.slug}: paso sin resaltado: ${texto}`);
    for (const id of pasoIngs) if (!ids.has(id)) errores.push(`${r.slug}: el paso usa ${id} que no está en la receta`);
  }
  const usados = new Set(r.pasos.flatMap((p) => p[2]));
  for (const [id] of r.ing) if (!usados.has(id)) errores.push(`${r.slug}: ${id} no aparece en ningún paso`);
  if (!r.foto || !r.url) errores.push(`${r.slug}: falta foto o enlace`);
  if (r.especial && !(r.antes || []).length) errores.push(`${r.slug}: un especial necesita «antes de empezar»`);
}
if (errores.length) {
  console.error(errores.join('\n'));
  process.exit(1);
}

const p1 =
  'insert into public.ingredientes (id, nombre, grupos, seccion, dias_nevera) values\n' +
  INGREDIENTES_NUEVOS.map(([id, nombre, grupos, seccion, dias]) => `(${q(id)},${q(nombre)},${arr(grupos)},${q(seccion)},${num(dias)})`).join(',\n') +
  '\non conflict (id) do update set nombre = excluded.nombre, grupos = excluded.grupos, seccion = excluded.seccion, dias_nevera = excluded.dias_nevera;\n';

const recetas = RECETAS.map((r) => ({ ...r, id: randomUUID() }));
const mapa = `(values ${recetas.map((r) => `(${q(r.slug)},${q(r.id)}::uuid)`).join(',')}) as r(slug, id)`;
const p2 =
  'insert into public.recetas (id, hogar_id, titulo, origen, url_origen, foto_url, tiempo_min, raciones, pasos, paleta, momentos, proteina, capricho, especial, antes) values\n' +
  recetas
    .map(
      (r) =>
        `(${q(r.id)},${q(hogarId)},${q(r.titulo)},'importada',${q(r.url)},${q(r.foto)},${num(r.tiempo)},2,` +
        `${json(r.pasos.map(([texto, min, ingredientes]) => ({ texto, min: min || null, ingredientes })))},${json(r.paleta)},${arr(r.momentos)},${q(r.proteina)},${!!r.capricho},${!!r.especial},${arr(r.antes)})`,
    )
    .join(',\n') +
  ';\n\ninsert into public.receta_ingredientes (receta_id, ingrediente_id, texto_original, cantidad, unidad, orden)\n' +
  'select r.id, v.i, coalesce(v.t, ing.nombre), v.c, v.u, v.o\nfrom (values\n' +
  recetas
    .flatMap((r) => r.ing.map(([i, c, u, t], o) => ({ s: r.slug, i, c, u, t, o })))
    .map((x, k) =>
      k === 0
        ? `(${q(x.s)}::text,${q(x.i)}::text,${q(x.t)}::text,${num(x.c)}::numeric,${q(x.u)}::text,${x.o}::smallint)`
        : `(${q(x.s)},${q(x.i)},${q(x.t)},${num(x.c)},${q(x.u)},${x.o})`,
    )
    .join(',\n') +
  `\n) as v(s, i, t, c, u, o)\njoin ${mapa} on r.slug = v.s\njoin public.ingredientes ing on ing.id = v.i;\n`;

writeFileSync(join(salida, `${conjunto}-1.sql`), p1);
writeFileSync(join(salida, `${conjunto}-2.sql`), p2);
console.log(`Recetas: ${recetas.length} · filas de ingredientes: ${recetas.reduce((n, r) => n + r.ing.length, 0)} · ingredientes nuevos: ${INGREDIENTES_NUEVOS.length}`);
console.log(`Tamaños: ${p1.length} / ${p2.length}`);
