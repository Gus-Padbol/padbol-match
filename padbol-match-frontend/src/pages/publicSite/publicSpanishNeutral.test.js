/** Evita que la web pública vuelva a usar voseo argentino. */

const fs = require('fs');
const path = require('path');

const voseo = /\b(?:Configurá|Operá|Llevá|Mostrá|Vendé|Activá|Creá|Definí|Aceptá|Cerrá|Dejá|Confirmá|Registrá|Elegí|Armá|Revisá|Publicá|Usá|Mantené|Completá|Sumá|Ocupá|Organizá|Ingresá|Conocé|Hacé|Podés|Querés|Tenés|Decís|Escribís|Volvés)\b/;

describe('español latinoamericano en la web pública', () => {
  it('mantiene las cards para sedes en español neutral', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'adminLanding', 'AdminVenueLandingPage.jsx'), 'utf8');

    expect(source).not.toMatch(voseo);
    expect(source).toMatch(/Configura tu sede/);
    expect(source).toMatch(/Crea competencia/);
    expect(source).toMatch(/Muestra y vende/);
  });

  it('mantiene el contenido de la landing pública sin voseo', () => {
    const locale = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'i18n', 'locales', 'es.json'), 'utf8'));
    const publicCopy = JSON.stringify({ landing: locale.landing, publicSite: locale.publicSite });

    expect(publicCopy).not.toMatch(voseo);
  });
});
