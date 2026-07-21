const {
  PUBLIC_SITE_INTERNAL_ROUTES,
  PUBLIC_SITE_NAV_ITEMS,
  PUBLIC_SITE_SECTION_ORDER,
  PUBLIC_SITE_SECTIONS,
} = require('./publicSiteContent');
const es = require('../i18n/locales/es.json');

describe('publicSite content structure', () => {
  const expectedAnchors = [
    'problema',
    'ecosistema',
    'experiencias',
    'jugadores',
    'sedes',
    'comunidad',
    'marcador',
    'torneos',
    'evolucion',
    'fidelizacion',
    'beneficios',
    'implementacion',
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
  });

  it('mantiene stores sin URL y CTAs sobre rutas internas reales', () => {
    expect(PUBLIC_SITE_SECTIONS.download.stores).toEqual([
      { key: 'appStore', url: null },
      { key: 'googlePlay', url: null },
    ]);
    expect(PUBLIC_SITE_SECTIONS.contact.ctas.map(({ to }) => to)).toEqual([
      '/hub',
      '/contacto',
      '/acceso',
    ]);
    expect(PUBLIC_SITE_INTERNAL_ROUTES).toEqual(
      expect.arrayContaining(['/hub', '/contacto', '/acceso', '/sobre', '/privacidad', '/terminos']),
    );
    PUBLIC_SITE_INTERNAL_ROUTES.forEach((route) => expect(route).toMatch(/^\/[a-z-]+$/));
  });

  it('tiene contenido español para todos los títulos, textos e items configurados', () => {
    Object.entries(PUBLIC_SITE_SECTIONS).forEach(([sectionKey, section]) => {
      expect(es.publicSite[sectionKey]?.title).toEqual(expect.any(String));
      expect(es.publicSite[sectionKey]?.text).toEqual(expect.any(String));
      (section.items || []).forEach(({ key }) => {
        expect(es.publicSite[sectionKey]?.items?.[key]?.title).toEqual(expect.any(String));
        expect(es.publicSite[sectionKey]?.items?.[key]?.text).toEqual(expect.any(String));
      });
    });
  });
});
