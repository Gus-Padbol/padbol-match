import { isPadbolVercelPreviewHostname } from './apiPublicBaseUrl';

describe('API base de previews Vercel', () => {
  it('reconoce únicamente previews del proyecto y equipo Padbol', () => {
    expect(isPadbolVercelPreviewHostname(
      'padbol-match-9abn-git-codex-admin-crm-notificati-68339f-padbol1.vercel.app',
    )).toBe(true);
    expect(isPadbolVercelPreviewHostname(
      'padbol-match-9abn-abc123-padbol1.vercel.app',
    )).toBe(true);
  });

  it('no convierte otros dominios Vercel ni producción en proxy confiable', () => {
    expect(isPadbolVercelPreviewHostname('malicioso.vercel.app')).toBe(false);
    expect(isPadbolVercelPreviewHostname('padbol-match-9abn.vercel.app')).toBe(false);
    expect(isPadbolVercelPreviewHostname('padbolmatch.com')).toBe(false);
  });
});
