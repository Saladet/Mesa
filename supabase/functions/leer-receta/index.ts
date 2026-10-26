// Lee una receta de una web (sus datos estructurados) para importarla en Mesa.
// Solo para usuarios con sesión: la plataforma valida el JWT y aquí se comprueba que sea de un usuario.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { extraerReceta } from './extraer.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const NAVEGADOR =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const MAX_BYTES = 4 * 1024 * 1024;

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function rolDelToken(cabecera: string | null): string | null {
  const token = (cabecera || '').replace(/^Bearer\s+/i, '');
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

// Solo webs públicas: nada de direcciones internas
function urlPermitida(texto: string): URL | null {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.startsWith('[') || h.includes(':')) return null;
  return u;
}

async function leerHtml(url: URL): Promise<{ estado: number; html: string }> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 12000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': NAVEGADOR, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'es-ES,es;q=0.9' },
      redirect: 'follow',
      signal: control.signal,
    });
    if (!r.ok || !r.body) return { estado: r.status, html: '' };
    const lector = r.body.getReader();
    const trozos: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value);
      total += value.length;
    }
    lector.cancel().catch(() => {});
    const unido = new Uint8Array(total);
    let pos = 0;
    for (const t of trozos) {
      unido.set(t, pos);
      pos += t.length;
    }
    const charset = (r.headers.get('content-type') || '').match(/charset=([\w-]+)/i)?.[1] || 'utf-8';
    let html: string;
    try {
      html = new TextDecoder(charset).decode(unido);
    } catch {
      html = new TextDecoder('utf-8').decode(unido);
    }
    return { estado: r.status, html };
  } finally {
    clearTimeout(reloj);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return respuesta({ ok: false, motivo: 'metodo' }, 405);
  if (rolDelToken(req.headers.get('Authorization')) !== 'authenticated') return respuesta({ ok: false, motivo: 'sesion' }, 401);

  let cuerpo: { url?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return respuesta({ ok: false, motivo: 'peticion' }, 400);
  }
  const url = urlPermitida(String(cuerpo.url || '').trim());
  if (!url) return respuesta({ ok: false, motivo: 'enlace' }, 400);

  try {
    const { estado, html } = await leerHtml(url);
    if (!html) return respuesta({ ok: false, motivo: 'web', estado });
    const receta = extraerReceta(html);
    if (!receta) return respuesta({ ok: false, motivo: 'sin_datos' });
    return respuesta({ ok: true, receta });
  } catch (e) {
    return respuesta({ ok: false, motivo: e instanceof DOMException && e.name === 'AbortError' ? 'tiempo' : 'web' });
  }
});
