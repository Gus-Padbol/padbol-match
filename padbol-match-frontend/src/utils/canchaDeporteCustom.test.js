import {
  buildCanchaDeporteApiPayload,
  buildCanchaWriteBody,
  canchaToModalDraft,
  DEPORTE_CUSTOM,
  formatCanchaManualOptionLabel,
  isDeporteCustom,
  resolveCanchaDeporteLabel,
  suggestedDurationForManualBooking,
  validateCanchaModalDraft,
} from './canchaDeporteCustom';

describe('canchaDeporteCustom', () => {
  it('nunca remapea custom a Padbol en label', () => {
    expect(isDeporteCustom('custom')).toBe(true);
    expect(resolveCanchaDeporteLabel({
      deporte: 'custom',
      deporte_personalizado: 'Beach Tennis',
    })).toBe('Beach Tennis');
    expect(resolveCanchaDeporteLabel({
      deporte: 'custom',
      deporte_label: 'Voley playa',
    })).toBe('Voley playa');
    expect(resolveCanchaDeporteLabel({ deporte: 'custom' })).not.toMatch(/padbol/i);
  });

  it('payload oficial limpia metadatos custom', () => {
    expect(buildCanchaDeporteApiPayload({ deporte: 'padbol' })).toEqual({
      deporte: 'padbol',
      deporte_personalizado: null,
      cantidad_jugadores: null,
      modalidad_custom: null,
      duracion_sugerida_min: null,
      observacion_custom: null,
    });
  });

  it('payload custom válido', () => {
    const body = buildCanchaWriteBody({
      nombre: ' Cancha 3 ',
      estado: 'activa',
      descripcion: '  ',
      deporte: 'custom',
      deporte_personalizado: '  Beach Tennis  ',
      cantidad_jugadores: '4',
      modalidad_custom: 'parejas',
      duracion_sugerida_min: '60',
      observacion_custom: ' Red baja ',
    });
    expect(body).toEqual({
      nombre: 'Cancha 3',
      estado: 'activa',
      descripcion: null,
      deporte: DEPORTE_CUSTOM,
      deporte_personalizado: 'Beach Tennis',
      cantidad_jugadores: 4,
      modalidad_custom: 'parejas',
      duracion_sugerida_min: 60,
      observacion_custom: 'Red baja',
    });
  });

  it('validaciones custom', () => {
    expect(validateCanchaModalDraft({
      nombre: '',
      deporte: 'custom',
    }).errorKey).toBe('nameRequired');
    expect(validateCanchaModalDraft({
      nombre: 'A',
      deporte: 'custom',
      deporte_personalizado: '',
      cantidad_jugadores: '4',
      modalidad_custom: 'individual',
    }).errorKey).toBe('customDisciplineRequired');
    expect(validateCanchaModalDraft({
      nombre: 'A',
      deporte: 'custom',
      deporte_personalizado: 'X',
      cantidad_jugadores: '0',
      modalidad_custom: 'individual',
    }).errorKey).toBe('customPlayersRange');
    expect(validateCanchaModalDraft({
      nombre: 'A',
      deporte: 'custom',
      deporte_personalizado: 'X',
      cantidad_jugadores: '2',
      modalidad_custom: 'triples',
    }).errorKey).toBe('customModalityInvalid');
    expect(validateCanchaModalDraft({
      nombre: 'A',
      deporte: 'custom',
      deporte_personalizado: 'X',
      cantidad_jugadores: '2',
      modalidad_custom: 'individual',
      duracion_sugerida_min: '14',
    }).errorKey).toBe('customDurationRange');
    expect(validateCanchaModalDraft({
      nombre: 'A',
      deporte: 'padbol',
    }).ok).toBe(true);
  });

  it('draft desde API custom conserva campos (no fuerza padbol)', () => {
    const d = canchaToModalDraft({
      nombre: 'VIP',
      estado: 'activa',
      deporte: 'custom',
      deporte_personalizado: 'Boxeo',
      cantidad_jugadores: 8,
      modalidad_custom: 'individual',
      duracion_sugerida_min: 45,
      observacion_custom: 'Guantes',
    });
    expect(d.deporte).toBe('custom');
    expect(d.deporte_personalizado).toBe('Boxeo');
    expect(d.cantidad_jugadores).toBe('8');
  });

  it('opción reserva manual muestra label personalizado', () => {
    expect(formatCanchaManualOptionLabel({
      nombre: 'Cancha Norte',
      orden: 2,
      deporte: 'custom',
      deporte_personalizado: 'Beach Tennis',
    })).toContain('Beach Tennis');
  });

  it('duración sugerida solo si es 60/90/120', () => {
    expect(suggestedDurationForManualBooking({
      deporte: 'custom',
      duracion_sugerida_min: 90,
    })).toBe(90);
    expect(suggestedDurationForManualBooking({
      deporte: 'custom',
      duracion_sugerida_min: 45,
    })).toBeNull();
  });
});
