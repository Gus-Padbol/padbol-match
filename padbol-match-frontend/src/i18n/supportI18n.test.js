import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('Support translations', () => {
  it('routes visible support copy through the locale catalog', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SupportTicketsPage.jsx'), 'utf8');
    ['Bandeja de soporte', 'No se pudieron cargar los casos', 'Abrir un caso', 'Cargando casos', 'Seleccioná un ticket']
      .forEach((literal) => expect(source).not.toContain(literal));
    expect(source).toContain("useSafeTranslation as useTranslation");
    expect(source).toContain('Intl.DateTimeFormat(locale');
  });

  it('has aligned Romanian support categories, states and actions', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').support;
    expect(ro.userTitle).toBe('Asistență umană');
    expect(Object.keys(ro.category)).toHaveLength(7);
    expect(Object.keys(ro.status)).toHaveLength(5);
    expect(Object.keys(ro.priority)).toHaveLength(4);
    expect(ro.internalNote).toMatch(/nu este afișată utilizatorului/iu);
  });

  it('has complete Czech support taxonomy', () => {
    const cs = i18n.getResourceBundle('cs', 'translation').support;
    expect(cs.category.tecnico).toBe('Technický problém');
    expect(cs.status.en_revision).toBe('Probíhá kontrola');
    expect(cs.priority.urgente).toBe('Naléhavá');
  });
});
