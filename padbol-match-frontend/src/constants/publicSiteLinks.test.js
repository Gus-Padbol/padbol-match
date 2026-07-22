const {
  PUBLIC_SITE_PATH,
  PUBLIC_SITE_CTA,
  PUBLIC_SITE_ANCHORS,
  PUBLIC_SITE_STORE_LINKS,
} = require('./publicSiteLinks');
const {
  isHubNavBarHiddenPathname,
  isLegalFooterGlobalBarVisiblePathname,
} = require('./hubLayout');

describe('publicSite links + shell isolation', () => {
  it('expone la ruta /plataforma y CTAs productivos', () => {
    expect(PUBLIC_SITE_PATH).toBe('/plataforma');
    expect(PUBLIC_SITE_CTA.exploreHash).toBe('#que-es');
    expect(PUBLIC_SITE_CTA.play).toBe('/hub');
    expect(PUBLIC_SITE_CTA.venue).toBe('/contacto');
    expect(PUBLIC_SITE_CTA.login).toBe('/acceso');
  });

  it('define anchors futuros sin stores aprobados', () => {
    expect(PUBLIC_SITE_ANCHORS.platform).toBe('#que-es');
    expect(PUBLIC_SITE_ANCHORS.players).toBe('#jugadores');
    expect(PUBLIC_SITE_ANCHORS.community).toBe('#comunidad-partidos');
    expect(PUBLIC_SITE_ANCHORS.scoreboard).toBe('#marcador-inteligente');
    expect(PUBLIC_SITE_ANCHORS.venues).toBe('#sedes');
    expect(PUBLIC_SITE_ANCHORS.download).toBe('#descargar');
    expect(PUBLIC_SITE_STORE_LINKS.appStore).toBeNull();
    expect(PUBLIC_SITE_STORE_LINKS.googlePlay).toBeNull();
  });

  it('oculta BottomNav y pie legal global en /plataforma', () => {
    expect(isHubNavBarHiddenPathname('/plataforma')).toBe(true);
    expect(isLegalFooterGlobalBarVisiblePathname('/plataforma')).toBe(false);
  });
});
