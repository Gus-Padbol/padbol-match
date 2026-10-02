import { createWhatsappCrmApiClient } from './whatsappCrmApi';

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe('cliente CRM de WhatsApp', () => {
  test('traduce filtros visuales al contrato del backend y manda JWT', async () => {
    const fetchImpl = jest.fn(async () => response({ contacts: [] }));
    const api = createWhatsappCrmApiClient({ token: 'jwt-qa', baseUrl: 'https://qa.example', fetchImpl });

    await api.list({ q: 'Gustavo', region: 'AR', status: 'nuevo' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('/api/admin/whatsapp/crm/contacts?');
    expect(url).toContain('query=Gustavo');
    expect(url).toContain('country=AR');
    expect(url).toContain('status=nuevo');
    expect(url).not.toContain('q=');
    expect(url).not.toContain('region=');
    expect(options.headers.Authorization).toBe('Bearer jwt-qa');
  });

  test('normaliza acción con guiones y conserva ficha/timeline', async () => {
    const fetchImpl = jest.fn(async () => response({
      contact: { id: 'contact-1', display_name: 'QA' },
      timeline: [{ kind: 'nota', detail: 'ok' }],
    }));
    const api = createWhatsappCrmApiClient({ baseUrl: 'https://qa.example', fetchImpl });

    const result = await api.action('contact-1', 'programar_seguimiento', {
      nextAction: 'Llamar', nextActionAt: '2026-10-03T12:00:00.000Z',
    });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://qa.example/api/admin/whatsapp/crm/contacts/contact-1/programar-seguimiento',
    );
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST');
    expect(result.contact.id).toBe('contact-1');
    expect(result.timeline).toHaveLength(1);
  });
});
