/** Mensajes en español para errores de Supabase Auth / PostgREST (evitar inglés crudo al usuario). */
export function mensajeErrorAuthSupabase(raw) {
  const s = String(raw || '').trim();
  const m = s.toLowerCase();

  if (!s) return 'Ocurrió un error. Probá de nuevo.';
  if (m.includes('invalid login credentials') || m.includes('invalid_grant')) {
    return 'WhatsApp, email o contraseña incorrectos. Verificá los datos e intentá de nuevo.';
  }
  if (m.includes('email not confirmed')) {
    return 'Tenés que confirmar tu correo antes de ingresar. Revisá tu bandeja de entrada.';
  }
  if (
    m.includes('user already registered') ||
    m.includes('already been registered') ||
    m.includes('already registered') ||
    m.includes('user already exists') ||
    m.includes('email address is already registered')
  ) {
    return 'El usuario ya existe';
  }
  if (m.includes('invalid email') || m.includes('email address is invalid') || m.includes('unable to validate email')) {
    return 'Email inválido';
  }
  if (m.includes('password')) {
    if (m.includes('least') || m.includes('short') || m.includes('6 characters') || m.includes('at least')) {
      return 'La contraseña es muy corta';
    }
  }
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('over_request_rate')) {
    return 'Hubo muchos intentos. Esperá unos segundos e intentá nuevamente.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Problema de conexión. Revisá tu internet e intentá de nuevo.';
  }

  return s.length > 280 ? `${s.slice(0, 280)}…` : s;
}

export function mensajeErrorDbSupabase(raw) {
  const s = String(raw || '').trim();
  const m = s.toLowerCase();
  if (!s) return 'Error al guardar. Probá de nuevo.';
  if (m.includes('duplicate') || m.includes('unique')) {
    return 'Ese dato ya está en uso. Verificá WhatsApp o email.';
  }
  if (m.includes('violates') || m.includes('constraint')) {
    return 'No se pudo guardar: datos no válidos. Revisá el formulario.';
  }
  return mensajeErrorAuthSupabase(s);
}
