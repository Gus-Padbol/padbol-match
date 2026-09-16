import fs from 'fs';
import path from 'path';

describe('public index authentication boundary', () => {
  it('does not forward authentication fragments to a different origin', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');

    expect(html).not.toContain('window.location.hash');
    expect(html).not.toContain('password_reset=1');
    expect(html).not.toContain('padbol-match-frontend.vercel.app');
  });
});
