const {
  PUBLIC_SITE_INTERNAL_ROUTES,
  PUBLIC_SITE_NAV_ITEMS,
  PUBLIC_SITE_SECTION_ORDER,
  PUBLIC_SITE_SECTIONS,
} = require('./publicSiteContent');
const es = require('../i18n/locales/es.json');

describe('publicSite content structure', () => {
  const expectedAnchors = [
    'nosotros',
    'que-es',
    'experiencias',
    'jugadores',
    'comunidad-partidos',
    'marcador-inteligente',
    'sedes',
    'continuidad',
    'expansion',
    'arbitro-virtual',
    'descargar',
    'contacto',
  ];

  it('define todas las secciones en orden y sin anchors duplicados', () => {
    expect(PUBLIC_SITE_SECTION_ORDER).toEqual(expectedAnchors);
    expect(new Set(PUBLIC_SITE_SECTION_ORDER).size).toBe(expectedAnchors.length);
  });

  it('hace que cada enlace de navegación apunte a una sección existente', () => {
    const anchors = new Set(PUBLIC_SITE_SECTION_ORDER.map((id) => `#${id}`));
    PUBLIC_SITE_NAV_ITEMS.forEach(({ href }) => expect(anchors.has(href)).toBe(true));
    expect(PUBLIC_SITE_NAV_ITEMS.map(({ key }) => key)).toEqual(
      expect.arrayContaining(['community', 'scoreboard']),
    );
    expect(PUBLIC_SITE_NAV_ITEMS[0].key).toBe('platform');
    expect(PUBLIC_SITE_NAV_ITEMS.at(-1)).toEqual(expect.objectContaining({ key: 'about', secondary: true }));
  });

  it('mantiene stores sin URL y CTAs sobre rutas internas reales', () => {
    expect(PUBLIC_SITE_SECTIONS.download.stores).toEqual([
      { key: 'appStore', url: null },
      { key: 'googlePlay', url: null },
    ]);
    expect(PUBLIC_SITE_SECTIONS.contact.ctas.map(({ to }) => to)).toEqual([
      '/administradores',
      '#descargar',
      '/acceso',
    ]);
    expect(PUBLIC_SITE_INTERNAL_ROUTES).toEqual(
      expect.arrayContaining([
        '#descargar',
        '/administradores',
        '/acceso',
        '/sobre',
        '/privacidad',
        '/eliminar-cuenta',
        '/terminos',
      ]),
    );
    PUBLIC_SITE_INTERNAL_ROUTES.forEach((route) => expect(route).toMatch(/^(?:\/[a-z-]+|#[a-z-]+)$/));
  });

  it('tiene contenido español para todos los títulos, textos e items configurados', () => {
    Object.entries(PUBLIC_SITE_SECTIONS).forEach(([sectionKey, section]) => {
      expect(es.publicSite[sectionKey]?.title).toEqual(expect.any(String));
      expect(es.publicSite[sectionKey]?.text).toEqual(expect.any(String));
      (section.items || []).forEach(({ key }) => {
        expect(es.publicSite[sectionKey]?.items?.[key]?.title).toEqual(expect.any(String));
        expect(es.publicSite[sectionKey]?.items?.[key]?.text).toEqual(expect.any(String));
      });
      (section.steps || []).forEach(({ key }) => {
        expect(es.publicSite[sectionKey]?.steps?.[key]?.title).toEqual(expect.any(String));
        expect(es.publicSite[sectionKey]?.steps?.[key]?.text).toEqual(expect.any(String));
      });
    });
  });

  it('diferencia expansión (futuro) de funciones actuales sin usar Próximamente', () => {
    expect(es.publicSite.expansion.note).toMatch(/gestiona|piloto|avanza/i);
    expect(es.publicSite.expansion.note).not.toMatch(/próximamente/i);
    expect(es.publicSite.download.storeSoon).not.toMatch(/próximamente/i);
    ['sponsor', 'ads', 'eshop'].forEach((key) => {
      expect(es.publicSite.expansion.items[key].title).toEqual(expect.any(String));
    });
  });

  it('explica comunidad/partidos y marcador inteligente con peso suficiente', () => {
    expect(es.publicSite.communityMatches.title).toMatch(/antes de entrar/i);
    expect(es.publicSite.communityMatches.text).toMatch(/crear un encuentro|partidos abiertos/i);
    expect(es.publicSite.smartScoreboard.title).toMatch(/Marcador inteligente/i);
    expect(es.publicSite.smartScoreboard.text).toMatch(/en vivo|mientras se juega/i);
    expect(es.publicSite.continuity.text).toMatch(/recorrido|encuentro|actividad/i);
  });
});
