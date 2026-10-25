import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'mesa-auth' },
});

// Traduce los errores habituales a algo entendible
export function mensajeError(error) {
  const m = (error && (error.message || String(error))) || '';
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/already registered|already exists/i.test(m)) return 'Ya hay una cuenta con ese email. Entra con tu contraseña.';
  if (/password should be at least|weak password/i.test(m)) return 'La contraseña necesita al menos 6 caracteres.';
  if (/email not confirmed/i.test(m)) return 'Falta confirmar el email: abre el correo que te ha llegado.';
  if (/invalid format|validate email/i.test(m)) return 'Ese email no parece válido.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos seguidos. Espera un minuto.';
  if (/fetch|network|load failed|offline/i.test(m)) return 'Sin conexión. Prueba otra vez en un momento.';
  return 'No se ha podido guardar. Prueba otra vez.';
}

export function esErrorDeRed(error) {
  const m = (error && (error.message || String(error))) || '';
  return !navigator.onLine || /fetch|network|load failed/i.test(m);
}
