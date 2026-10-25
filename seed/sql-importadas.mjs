// SQL para añadir las recetas importadas (y los ingredientes nuevos del catálogo).
// Uso: node seed/sql-importadas.mjs <hogar_id> <carpeta_salida>
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INGREDIENTES } from './datos.js';
import { INGREDIENTES_NUEVOS, IMPORTADAS } from './importadas.js';

const [hogarId, salida] = process.argv.slice(2);
if (!hogarId || !salida) {
  console.error('Uso: node seed/sql-importadas.mjs <hogar_id> <carpeta_salida>');
  process.exit(1);
}
const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a && a.length ? `array[${a.map(q).join(',')}]::text[]` : `'{}'::text[]`);
const json = (o) => `${q(JSON.stringify(o))}::jsonb`;
const num = (n) => (n == null ? 'null' : String(n));

const catalogo = new Map([...INGREDIENTES, ...INGREDIENTES_NUEVOS].map(([id, nombre]) => [id, nombre]));
const errores = [];
const slugs = new Set();
for (const r of IMPORTADAS) {
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
}
if (errores.length) {
  console.error(errores.join('\n'));
  process.exit(1);
}

const p1 =
  'insert into public.ingredientes (id, nombre, grupos, seccion, dias_nevera) values\n' +
  INGREDIENTES_NUEVOS.map(([id, nombre, grupos, seccion, dias]) => `(${q(id)},${q(nombre)},${arr(grupos)},${q(seccion)},${num(dias)})`).join(',\n') +
  '\non conflict (id) do update set nombre = excluded.nombre, grupos = excluded.grupos, seccion = excluded.seccion, dias_nevera = excluded.dias_nevera;\n';

const recetas = IMPORTADAS.map((r) => ({ ...r, id: randomUUID() }));
const mapa = `(values ${recetas.map((r) => `(${q(r.slug)},${q(r.id)}::uuid)`).join(',')}) as r(slug, id)`;
const p2 =
  'insert into public.recetas (id, hogar_id, titulo, origen, url_origen, foto_url, tiempo_min, raciones, pasos, paleta, momentos, proteina, capricho) values\n' +
  recetas
    .map(
      (r) =>
        `(${q(r.id)},${q(hogarId)},${q(r.titulo)},'importada',${q(r.url)},${q(r.foto)},${num(r.tiempo)},2,` +
        `${json(r.pasos.map(([texto, min, ingredientes]) => ({ texto, min: min || null, ingredientes })))},${json(r.paleta)},${arr(r.momentos)},${q(r.proteina)},${!!r.capricho})`,
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

writeFileSync(join(salida, 'importadas-1.sql'), p1);
writeFileSync(join(salida, 'importadas-2.sql'), p2);
console.log(`Recetas: ${recetas.length} · filas de ingredientes: ${recetas.reduce((n, r) => n + r.ing.length, 0)} · ingredientes nuevos: ${INGREDIENTES_NUEVOS.length}`);
console.log(`Tamaños: ${p1.length} / ${p2.length}`);
