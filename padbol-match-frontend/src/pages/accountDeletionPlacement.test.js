import fs from 'fs';
import path from 'path';

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('ubicación segura de la eliminación de cuenta', () => {
  test('Mi perfil deja cerrar sesión sin mostrar una acción destructiva contigua', () => {
    const profileSource = source('./MiPerfil.jsx');

    expect(profileSource).toContain("t('auth.cerrar_sesion')");
    expect(profileSource).not.toContain('Eliminar mi cuenta');
    expect(profileSource).not.toContain('requestAccountDeletion');
  });

  test('la eliminación permanece disponible en una página separada con confirmación', () => {
    const deletionSource = source('./EliminarCuenta.jsx');

    expect(deletionSource).toContain('Solicitar eliminación de cuenta');
    expect(deletionSource).toContain('requestAccountDeletion');
    expect(deletionSource).toContain('confirmDanger');
    expect(deletionSource).toContain('Sí, eliminar mi cuenta');
  });

  test('el pie muestra un acceso discreto de cuenta y privacidad', () => {
    const footerSource = source('../components/LegalFooterBar.jsx');

    expect(footerSource).toContain('to="/eliminar-cuenta"');
    expect(footerSource).toContain('Cuenta y privacidad');
    expect(footerSource).not.toContain('>\n          Eliminar cuenta\n');
  });
});
