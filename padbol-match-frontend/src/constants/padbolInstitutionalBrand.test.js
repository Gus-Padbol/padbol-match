import fs from 'fs';
import path from 'path';
import {createHash} from 'crypto';
import {
  PADBOL_INTERNACIONAL_LOGO_ON_DARK,
  PADBOL_INTERNACIONAL_LOGO_ON_LIGHT,
  PADBOL_INTERNACIONAL_LOGO_ON_DARK_PNG,
  PADBOL_INTERNACIONAL_LOGO_ON_LIGHT_PNG,
} from './padbolInstitutionalBrand';

const asset = (url) => path.join(process.cwd(), 'public', url.replace(/^\//, ''));
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('identidad institucional oficial de Padbol Internacional', () => {
  it('usa los SVG y PNG exactos de PADBOL LOGOS.zip', () => {
    expect(hash(asset(PADBOL_INTERNACIONAL_LOGO_ON_DARK))).toBe('d3b2e7bd6f10771dc668f4f690490dd3ae075d07885763748239a95bdbcfc319');
    expect(hash(asset(PADBOL_INTERNACIONAL_LOGO_ON_LIGHT))).toBe('05344f66a0745bab04a111c4e1f2180ff8d305ea0e88fdc071dcb048fd4365e1');
    expect(hash(asset(PADBOL_INTERNACIONAL_LOGO_ON_DARK_PNG))).toBe('92066184cdb130af5484927b13cbdae348ea84ea951d2768d5f82aace45ef8b9');
    expect(hash(asset(PADBOL_INTERNACIONAL_LOGO_ON_LIGHT_PNG))).toBe('4e352420f35f3ca47aab6c1be2d276dbda255a66aa069da3ac72c7d3d7fff594');
  });

  it('elige la variante A blanca para el encabezado oscuro y conserva la B para fondos claros', () => {
    expect(PADBOL_INTERNACIONAL_LOGO_ON_DARK).toContain('padbol-internacional-dark.svg');
    expect(PADBOL_INTERNACIONAL_LOGO_ON_LIGHT).toContain('padbol-internacional-light.svg');
    expect(fs.readFileSync(asset(PADBOL_INTERNACIONAL_LOGO_ON_DARK), 'utf8')).toContain('fill: #fff');
    expect(fs.readFileSync(asset(PADBOL_INTERNACIONAL_LOGO_ON_LIGHT), 'utf8')).not.toContain('fill: #fff');
  });
});
