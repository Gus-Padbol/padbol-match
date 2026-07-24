const fs = require('fs');
const path = require('path');

function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('acciones administrativas sensibles', () => {
  it('envía el token al eliminar torneos y guardar puntos', () => {
    const source = readSource('../pages/AdminDashboard.jsx');
    expect(source).toMatch(
      /eliminarTorneo[\s\S]*?headers\.Authorization = `Bearer \$\{session\.access_token\}`[\s\S]*?method: 'DELETE'/,
    );
    expect(source).toMatch(
      /guardarConfig[\s\S]*?headers\.Authorization = `Bearer \$\{session\.access_token\}`[\s\S]*?api\/config\/puntos/,
    );
  });

  it('envía el token al finalizar un torneo', () => {
    const source = readSource('../pages/TorneoVista.jsx');
    expect(source).toMatch(
      /finalizarTorneo[\s\S]*?headers\.Authorization = `Bearer \$\{session\.access_token\}`[\s\S]*?\/finalizar/,
    );
  });
});
