import {
  extractCourtNumber,
  formatScoreboardVenueHeader,
  isDemoCourtPlaceholder,
  resolveScoreboardCanchaLabel,
  resolveScoreboardSedeLabel,
} from './scoreboardVenueLabels';

describe('scoreboardVenueLabels', () => {
  it('detecta Court One como placeholder demo', () => {
    expect(isDemoCourtPlaceholder('Court One')).toBe(true);
    expect(isDemoCourtPlaceholder('Cancha 1')).toBe(false);
  });

  it('extrae número desde Court One', () => {
    expect(extractCourtNumber('Court One')).toBe(1);
    expect(extractCourtNumber('Cancha 1')).toBe(1);
  });

  it('prioriza cancha_nombre real', () => {
    expect(resolveScoreboardCanchaLabel({
      cancha: 'Court One',
      cancha_nombre: 'Cancha 1',
    })).toBe('Cancha 1');
  });

  it('normaliza Court One a Cancha 1', () => {
    expect(resolveScoreboardCanchaLabel({ cancha: 'Court One' })).toBe('Cancha 1');
  });

  it('fallback Cancha si falta nombre', () => {
    expect(resolveScoreboardCanchaLabel({})).toBe('Cancha');
  });

  it('sede nunca usa Sede #id', () => {
    expect(resolveScoreboardSedeLabel({ sede_id: 1, sede_nombre: 'La Meca' })).toBe('La Meca');
    expect(resolveScoreboardSedeLabel({ sede_id: 1 })).toBeNull();
    expect(resolveScoreboardSedeLabel({ sede_nombre: 'Sede #1' })).toBeNull();
  });

  it('header Cancha 1 · La Meca para el caso productivo', () => {
    expect(formatScoreboardVenueHeader({
      cancha: 'Court One',
      sede_id: 1,
      sede_nombre: 'La Meca',
    })).toBe('Cancha 1 · La Meca');
  });

  it('oculta sede si no hay nombre real', () => {
    expect(formatScoreboardVenueHeader({ cancha: 'Cancha 1', sede_id: 1 })).toBe('Cancha 1');
  });
});
