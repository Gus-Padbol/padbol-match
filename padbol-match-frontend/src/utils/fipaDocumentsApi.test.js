import {
  FIPA_DOCUMENT_CATALOG,
  FIPA_NOT_FOUND_VENUE_VALUE,
  buildFipaAccessRequestPayload,
  downloadFipaDocument,
  fetchFipaLibraryState,
  fetchOfficialFipaVenues,
  mergeFipaDocumentCatalog,
  normalizeFipaLibraryState,
  normalizeFipaDocumentSlug,
  normalizeOfficialFipaVenues,
  submitFipaAccessRequest,
  submitFipaInterestProfile,
  validateFipaAccessRequestForm,
} from './fipaDocumentsApi';

const originalFetch = global.fetch;

test('el enlace del Código desde la web oficial conserva el documento elegido', () => {
  expect(normalizeFipaDocumentSlug('codigo-de-conducta')).toBe('codigo-conducta');
  expect(normalizeFipaDocumentSlug('reglamento-oficial')).toBe('reglamento-oficial');
});

const validForm = {
  purpose: 'jugador',
  purposeOther: '',
  playsPadbol: 'yes',
  clubLink: 'yes',
  venueId: FIPA_NOT_FOUND_VENUE_VALUE,
  country: 'Uruguay',
  city: 'Montevideo',
  venueName: 'Cancha del barrio',
  location: 'https://maps.example/cancha',
  purposeAcknowledged: true,
  whatsappOptIn: false,
  whatsapp: '',
};

describe('fipaDocumentsApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('mantiene dos documentos para cuenta con ficha y siete sólo para miembros', () => {
    expect(FIPA_DOCUMENT_CATALOG).toHaveLength(9);
    expect(FIPA_DOCUMENT_CATALOG.filter((item) => item.accessLevel === 'authenticated')).toHaveLength(2);
    expect(FIPA_DOCUMENT_CATALOG.filter((item) => item.accessLevel === 'member')).toHaveLength(7);
    expect(FIPA_DOCUMENT_CATALOG.map((item) => item.slug)).toEqual([
      'reglamento-oficial',
      'codigo-conducta',
      'reglamento-competiciones-internacionales',
      'manual-arbitros',
      'protocolo-contingencia-planilla',
      'criterios-ranking-desempate',
      'manual-organizador',
      'patrocinio-marca-transmision',
      'inscripcion-autorizacion-imagen',
    ]);
  });

  it('mantiene cerrada la descarga si el backend no publicó el documento', () => {
    expect(mergeFipaDocumentCatalog([]).every((item) => item.published === false)).toBe(true);
    expect(mergeFipaDocumentCatalog([
      { id: 'uuid-reglas', slug: 'reglamento-oficial', status: 'published' },
    ])[0]).toEqual(expect.objectContaining({ serverId: 'uuid-reglas', published: true }));
  });

  it('normaliza el listado ya filtrado por la ruta segura de sedes oficiales', () => {
    expect(normalizeOfficialFipaVenues([
      { id: 2, nombre: 'B', ciudad: 'Rosario' },
      { id: 1, nombre: 'A', ciudad: 'La Plata' },
      { id: null, nombre: 'Sin id' },
    ])).toEqual([
      expect.objectContaining({ id: '1', nombre: 'A', ciudad: 'La Plata' }),
      expect.objectContaining({ id: '2', nombre: 'B', ciudad: 'Rosario' }),
    ]);
  });

  it('conserva una cancha no encontrada sin fingir que es una sede oficial', () => {
    expect(validateFipaAccessRequestForm(validForm, [])).toBeNull();
    expect(buildFipaAccessRequestPayload(validForm, [])).toEqual(expect.objectContaining({
      purpose: 'jugador',
      plays_padbol: 'yes',
      linked_to_club: 'yes',
      sede_id: null,
      cancha_no_encontrada: true,
      pais: 'Uruguay',
      ciudad: 'Montevideo',
      nombre_cancha: 'Cancha del barrio',
      whatsapp: null,
      whatsapp_consent: false,
    }));
  });

  it('permite no declarar vínculo y no envía datos de cancha residuales', () => {
    const form = { ...validForm, clubLink: 'prefer_not' };
    expect(validateFipaAccessRequestForm(form, [])).toBeNull();
    expect(buildFipaAccessRequestPayload(form, [])).toEqual(expect.objectContaining({
      linked_to_club: 'prefer_not',
      sede_id: null,
      cancha_no_encontrada: false,
      pais: null,
      ciudad: null,
      nombre_cancha: null,
      direccion_ubicacion: null,
    }));
  });

  it('exige detalle para otro motivo y consentimiento separado sólo para WhatsApp', () => {
    expect(validateFipaAccessRequestForm({ ...validForm, purpose: 'otro' }, []))
      .toBe('purposeOtherRequired');
    expect(validateFipaAccessRequestForm({ ...validForm, whatsappOptIn: true, whatsapp: '123' }, []))
      .toBe('whatsappInvalid');
    expect(validateFipaAccessRequestForm({ ...validForm, whatsappOptIn: false, whatsapp: '123' }, []))
      .toBeNull();
  });

  it('normaliza el contrato real de ficha, solicitud y membresía', () => {
    expect(normalizeFipaLibraryState({
      authenticated_access: true,
      member_access: false,
      profile: { completed_at: '2026-09-08T10:00:00Z' },
      request: { status: 'pending' },
    })).toEqual(expect.objectContaining({
      status: 'pending',
      grantActive: false,
      interestCompleted: true,
    }));
    expect(normalizeFipaLibraryState({ authenticated_access: true, member_access: true }))
      .toEqual(expect.objectContaining({ status: 'approved', grantActive: true, interestCompleted: true }));
  });

  it('consulta las sedes oficiales con Bearer en la ruta protegida', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ venues: [{ id: 3, nombre: 'Sede Centro' }] }),
    });
    await expect(fetchOfficialFipaVenues({ apiBaseUrl: 'https://api.test', accessToken: 'token' }))
      .resolves.toEqual([expect.objectContaining({ id: '3', nombre: 'Sede Centro' })]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/api/fipa/biblioteca/sedes-oficiales',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    );
  });

  it('guarda la ficha con PUT y envía solicitudes de miembro con POST', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await submitFipaInterestProfile({
      apiBaseUrl: 'https://api.test',
      accessToken: 'token-seguro',
      body: { purpose: 'jugador' },
    });
    await submitFipaAccessRequest({
      apiBaseUrl: 'https://api.test',
      accessToken: 'token-seguro',
      body: { sede_id: 7 },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.test/api/fipa/biblioteca/perfil',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ purpose: 'jugador' }) }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.test/api/fipa/biblioteca/solicitudes',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ sede_id: 7 }) }),
    );
  });

  it('no consulta el estado sin token', async () => {
    global.fetch = jest.fn();
    await expect(fetchFipaLibraryState({ apiBaseUrl: 'https://api.test' })).rejects.toMatchObject({ status: 401 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('abre la download_url exacta del backend sin enviar referrer', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => ({ download_url: 'https://storage.example/short-lived' }),
    });
    await expect(downloadFipaDocument({
      apiBaseUrl: 'https://api.test',
      accessToken: 'token',
      document: { id: 'codigo-conducta', slug: 'codigo-conducta' },
    })).resolves.toEqual({ mode: 'signed-url', url: 'https://storage.example/short-lived' });
    expect(click).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/api/fipa/biblioteca/documentos/codigo-conducta/descarga',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
