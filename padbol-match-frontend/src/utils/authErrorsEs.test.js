import { mensajeErrorAuthSupabase } from './authErrorsEs';

describe('mensajeErrorAuthSupabase', () => {
  it.each(['Invalid login credentials', 'invalid_grant'])(
    'describe el login real por correo sin mencionar WhatsApp (%s)',
    (raw) => {
      const message = mensajeErrorAuthSupabase(raw);
      expect(message).toBe(
        'Correo electrónico o contraseña incorrectos. Verificá los datos e intentá nuevamente.',
      );
      expect(message).not.toMatch(/WhatsApp/i);
    },
  );
});
