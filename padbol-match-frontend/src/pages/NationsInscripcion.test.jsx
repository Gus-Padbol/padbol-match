import React from 'react';
import fs from 'fs';
import path from 'path';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import NationsInscripcion from './NationsInscripcion';

const mockUseAuth = jest.fn();
const mockFetch = jest.fn();
let mockLanguage = 'es';

jest.mock('../context/AuthContext', () => ({useAuth: () => mockUseAuth()}));
jest.mock('../i18n/tSafe', () => ({
  useSafeTranslation: () => ({i18n: {language: mockLanguage}, t: (k) => k}),
}));

const waitReady = async (buttonName = 'Enviar solicitud') => {
  await waitFor(() => expect(screen.getByRole('button', {name: buttonName})).toBeEnabled());
};
const settleRestore = async () => {
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('Recuperando tu solicitud…')).not.toBeInTheDocument());
};
const appTree = (slug = 'nations-cup-napoli-2026') => (
  <MemoryRouter initialEntries={[`/nations-cup/${slug}/inscripcion`]}>
    <Routes><Route path="/nations-cup/:slug/inscripcion" element={<NationsInscripcion />} /></Routes>
  </MemoryRouter>
);
const mount = (slug = 'nations-cup-napoli-2026') => render(appTree(slug));
const fillIdentity = ({name = 'Jugador Ficticio', country = 'IT', age = 'Mayor de edad'} = {}) => {
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {target: {value: name}});
  fireEvent.change(screen.getByLabelText('País'), {target: {value: country}});
  fireEvent.click(screen.getByLabelText(age));
};
const acceptConsent = () => fireEvent.click(screen.getByLabelText(/Autorizo el uso de mis datos/));
const send = () => fireEvent.click(screen.getByRole('button', {name: 'Enviar solicitud'}));
const posts = () => mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
const NAPOLI_CODES = ['RO', 'ES', 'PT', 'QA', 'IT', 'DE', 'FR', 'BE', 'AT', 'EG', 'AE', 'MX', 'SE', 'UA', 'DK'];

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'es';
  sessionStorage.clear();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: []})});
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-1', email_confirmed_at: '2026-01-01'}, access_token: 'tok'}, loading: false});
});

test('sin sesión pide ingresar con retorno seguro', () => {
  mockUseAuth.mockReturnValue({session: null, loading: false});
  mount();
  expect(screen.getByRole('link', {name: 'Ingresar'})).toHaveAttribute('href', expect.stringContaining('/login?redirect='));
});

test('el formulario es una tarjeta Padbol con etiquetas asociadas, edad clara y CTA grande', async () => {
  const {container} = mount();
  await waitReady();

  expect(container.querySelector('main.nations-page')).toBeInTheDocument();
  expect(container.querySelector('.nations-card')).toBeInTheDocument();
  expect(container.querySelector('form.nations-form')).toBeInTheDocument();
  const logos = screen.getAllByRole('img', {name: 'Padbol Match'});
  expect(logos).toHaveLength(2);
  expect(logos[0]).toHaveAttribute('src', '/brand/oficial-2026/padbol-internacional-light.svg');
  expect(logos[1]).toHaveAttribute('src', '/brand/oficial-2026/padbol-internacional-dark.svg');
  expect(logos[0]).toHaveClass('nations-brand__logo');
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Completa tus datos para la Nations Cup');

  const nameInput = screen.getByLabelText('Nombre y apellido');
  const nameLabel = screen.getByText('Nombre y apellido');
  expect(nameLabel.tagName).toBe('LABEL');
  expect(nameLabel).toHaveAttribute('for', nameInput.id);
  expect(nameInput).toHaveClass('nations-input');
  expect(nameLabel.compareDocumentPosition(nameInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  expect(screen.getByRole('group', {name: 'Edad'})).toBeInTheDocument();
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect(screen.getByLabelText('Prefiero no informar')).toBeChecked();
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  expect(acceptConsentCheckbox()).not.toBeChecked();
  expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toHaveClass('nations-button');
});

function acceptConsentCheckbox() {
  return screen.getByLabelText(/Autorizo el uso de mis datos/);
}

test('copy público: no expone criterios internos de habilitación', async () => {
  mount();
  await waitReady();
  expect(document.body.textContent).not.toMatch(/No se habilita automáticamente|por nombre y país|coincidencia encontrada|encontramos tu perfil/i);
});

test('envía payload correcto y muestra recepción pendiente sin afirmar coincidencia', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})});
  mount();
  await waitReady();
  fillIdentity();
  acceptConsent();
  send();
  await waitFor(() => expect(screen.getByText(/Queda pendiente de revisión/)).toBeInTheDocument());

  const payload = JSON.parse(posts()[0][1].body);
  expect(payload).toEqual({
    request_id: expect.stringMatching(/^[A-Za-z0-9_-]{8,120}$/),
    declared_name: 'Jugador Ficticio',
    declared_country: 'IT',
    age_status: 'adulto',
    guardian_consent: false,
    profile_consent: true,
  });
  expect(screen.getByRole('status')).toHaveClass('nations-status--pending');
  expect(screen.queryByText(/No necesitas enviarla otra vez/)).toBeInTheDocument();
  expect(document.querySelector('form')).toBeNull();
  expect(document.body.textContent).not.toMatch(/coincidencia encontrada|encontramos tu perfil/i);
});

test('faltando consentimiento el aviso no afirma que falte edad', async () => {
  mount();
  await waitReady();
  fillIdentity();
  send();
  expect(posts()).toHaveLength(0);
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('Completa los datos y las autorizaciones obligatorias.');
  expect(alert).not.toHaveTextContent(/edad/i);
});

test('menor exige autorización declarada del responsable y la revela sólo para menores', async () => {
  mount();
  await waitReady();
  fillIdentity();
  expect(screen.queryByLabelText(/Declaro que soy responsable/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Menor de edad'));
  const guardian = screen.getByLabelText(/Declaro que soy responsable/);
  expect(guardian).not.toBeChecked();
  acceptConsent();
  send();
  expect(posts()).toHaveLength(0);
  expect(screen.getByRole('alert')).toHaveTextContent(/Completa los datos y las autorizaciones obligatorias/);
  expect(screen.getByRole('alert')).not.toHaveTextContent(/edad/i);

  fireEvent.click(guardian);
  fireEvent.click(screen.getByLabelText('Mayor de edad'));
  expect(screen.queryByLabelText(/Declaro que soy responsable/)).not.toBeInTheDocument();
});

test('conflicto 409 muestra mensaje claro y no duplica envíos', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: false, status: 409, json: async () => ({code: 'REQUEST_CONFLICT'})});
  mount();
  await waitReady();
  fillIdentity();
  acceptConsent();
  const boton = screen.getByRole('button', {name: 'Enviar solicitud'});
  fireEvent.click(boton); fireEvent.click(boton);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/solicitud activa/));
  expect(posts()).toHaveLength(1);
});

test('restaura estado propio al refrescar y mantiene el mismo request_id', async () => {
  sessionStorage.setItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026', 'req-estable-0001');
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente', age_status: 'desconocido', request_id: 'req-estable-0001'}]})});
  mount();
  await waitFor(() => expect(screen.getByText(/Queda pendiente de revisión/)).toBeInTheDocument());
  expect(posts()).toHaveLength(0);
});

test('cambio de actor limpia estado y usa otro request_id', async () => {
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente'}]})});
  const {unmount} = mount();
  await waitFor(() => expect(screen.getByText(/Queda pendiente/)).toBeInTheDocument());
  unmount();
  sessionStorage.clear();
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-2', email_confirmed_at: '2026-01-01'}, access_token: 'tok2'}, loading: false});
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: []})});
  mount();
  await waitReady();
  expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeInTheDocument();
  expect(sessionStorage.getItem('nationsProfileRequest:actor-2:nations-cup-napoli-2026')).toMatch(/./);
});

test('edad no informada se puede enviar y conserva age_status desconocido', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})});
  mount();
  await waitReady();
  fillIdentity({age: 'Prefiero no informar'});
  acceptConsent();
  send();
  await waitFor(() => expect(screen.getByText(/Queda pendiente/)).toBeInTheDocument());
  expect(JSON.parse(posts()[0][1].body).age_status).toBe('desconocido');
});

test('Nápoles 2026 lista exactamente las 15 selecciones del PDF, sin duplicados', async () => {
  mount();
  await waitReady();
  const select = screen.getByLabelText('País');
  const options = Array.from(select.querySelectorAll('option'));
  expect(options).toHaveLength(16); // 15 países + placeholder
  expect(options[0].value).toBe('');
  const values = options.slice(1).map((o) => o.value);
  expect(values).toEqual(NAPOLI_CODES);
  expect(new Set(values).size).toBe(15);
  for (const code of ['US', 'BR', 'CL', 'CO', 'AR', 'UY', 'RS']) {
    expect(values).not.toContain(code);
  }
  expect(values).toContain('QA');
  expect(values).toContain('AE');
  const labels = options.slice(1).map((o) => o.textContent).join(' ');
  expect(labels).toMatch(/Rumania/);
  expect(labels).toMatch(/Emiratos Árabes Unidos/);
});

test('otros slugs conservan el catálogo mundial actual de la app', async () => {
  mount('nations-cup-otro-2026');
  await waitReady();
  const values = Array.from(screen.getByLabelText('País').querySelectorAll('option')).slice(1).map((o) => o.value);
  expect(values.length).toBeGreaterThan(10);
  expect(values).toContain('US');
  expect(values).toContain('BR');
  expect(values).toContain('AR');
});

test('las 15 etiquetas de país se traducen en ES/EN/IT', async () => {
  const expected = {
    es: ['Rumania', 'España', 'Portugal', 'Catar', 'Italia', 'Alemania', 'Francia', 'Bélgica', 'Austria', 'Egipto', 'Emiratos Árabes Unidos', 'México', 'Suecia', 'Ucrania', 'Dinamarca'],
    en: ['Romania', 'Spain', 'Portugal', 'Qatar', 'Italy', 'Germany', 'France', 'Belgium', 'Austria', 'Egypt', 'United Arab Emirates', 'Mexico', 'Sweden', 'Ukraine', 'Denmark'],
    it: ['Romania', 'Spagna', 'Portogallo', 'Qatar', 'Italia', 'Germania', 'Francia', 'Belgio', 'Austria', 'Egitto', 'Emirati Arabi Uniti', 'Messico', 'Svezia', 'Ucraina', 'Danimarca'],
  };
  const buttonName = {es: 'Enviar solicitud', en: 'Send request', it: 'Invia richiesta'};
  const countryLabel = {es: 'País', en: 'Country', it: 'Paese'};
  for (const lang of ['es', 'en', 'it']) {
    mockLanguage = lang;
    const {unmount} = mount();
    await waitReady(buttonName[lang]);
    const labels = Array.from(screen.getByLabelText(countryLabel[lang]).querySelectorAll('option')).slice(1).map((o) => o.textContent);
    expect(labels).toHaveLength(15);
    expected[lang].forEach((name, index) => expect(labels[index]).toContain(name));
    unmount();
    sessionStorage.clear();
  }
});

test('payload declared_country usa el ISO exacto de las 15 selecciones', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    return {ok: true, status: 200, json: async () => ({ok: true, requests: []})};
  });
  for (const code of NAPOLI_CODES) {
    const {unmount} = mount();
    await waitReady();
    fillIdentity({country: code});
    acceptConsent();
    send();
    await waitFor(() => expect(screen.getByText(/Queda pendiente/)).toBeInTheDocument());
    expect(JSON.parse(posts().at(-1)[1].body).declared_country).toBe(code);
    unmount();
    sessionStorage.clear();
  }
});

test('email sin verificar bloquea el envio y lo explica', async () => {
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-3'}, access_token: 'tok3'}, loading: false});
  mount();
  await settleRestore();
  expect(screen.getByRole('alert')).toHaveTextContent(/Verifica tu email/);
  expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeDisabled();
});

test('fallo de red al restaurar muestra aviso y permite reintentar sin recargar', async () => {
  mockFetch
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente'}]})});
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos consultar tu solicitud/));
  expect(screen.getByRole('alert')).not.toHaveTextContent(/No pudimos enviar/);
  expect(screen.getByRole('button', {name: 'Reintentar'})).toBeEnabled();

  fireEvent.click(screen.getByRole('button', {name: 'Reintentar'}));
  await waitFor(() => expect(screen.getByText(/Queda pendiente de revisión/)).toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  const gets = mockFetch.mock.calls.filter(([, opts]) => !opts?.method);
  expect(gets).toHaveLength(2);
  expect(gets[0][0]).toBe(gets[1][0]);
});

test('restauración 503 muestra aviso y reintenta sólo por GET, sin POST', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: false, status: 503, json: async () => ({})})
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente'}]})});
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos consultar tu solicitud/));
  expect(posts()).toHaveLength(0);

  fireEvent.click(screen.getByRole('button', {name: 'Reintentar'}));
  await waitFor(() => expect(screen.getByText(/Queda pendiente de revisión/)).toBeInTheDocument());
  const gets = mockFetch.mock.calls.filter(([, opts]) => !opts?.method);
  expect(gets).toHaveLength(2);
  expect(gets[0][0]).toBe(gets[1][0]);
  expect(posts()).toHaveLength(0);
});

test('una respuesta vieja de restauración no pisa el cambio de actor/evento', async () => {
  let resolveOld;
  mockFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = mount();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Recuperando tu solicitud…'));

  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-2', email_confirmed_at: '2026-01-01'}, access_token: 'tok2'}, loading: false});
  view.rerender(appTree());
  await waitReady();

  await act(async () => {
    resolveOld({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'rechazada'}]})});
    await Promise.resolve();
  });

  expect(screen.queryByText(/no fue aprobada/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeInTheDocument();
});

test('rechazada permite nueva solicitud sin recargar y con id nuevo', async () => {
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'rechazada'}]})});
  mount();
  await waitFor(() => expect(screen.getByText(/no fue aprobada/)).toBeInTheDocument());
  expect(screen.getByRole('alert')).toHaveClass('nations-status--rejected');
  const antes = sessionStorage.getItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026');
  fireEvent.click(screen.getByRole('button', {name: 'Enviar nueva solicitud'}));
  const despues = sessionStorage.getItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026');
  expect(despues).not.toBe(antes);
  expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeInTheDocument();
});

test('aprobada ofrece ir al perfil y no muestra el formulario', async () => {
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'aprobada'}]})});
  mount();
  await waitFor(() => expect(screen.getByText(/Ya puedes entrar a tu perfil/)).toBeInTheDocument());
  expect(screen.getByRole('status')).toHaveClass('nations-status--approved');
  expect(screen.getByRole('link', {name: 'Ir a mi perfil'})).toHaveAttribute('href', '/mi-perfil');
  expect(document.querySelector('form')).toBeNull();
});

test('REGRESION rechazo->nueva: el segundo POST usa OTRO request_id', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    const u = String(url);
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body);
      // el backend real devuelve 409 si se reusa un id ya revisado
      if (body.request_id === 'req-rechazado-01') return {ok: false, status: 409, json: async () => ({code: 'REQUEST_CONFLICT'})};
      return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    }
    if (u.includes('/profile-request')) return {ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'rechazada', request_id: 'req-rechazado-01'}]})};
    return {ok: true, status: 200, json: async () => ({})};
  });
  sessionStorage.setItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026', 'req-rechazado-01');
  mount();
  await waitFor(() => expect(screen.getByText(/no fue aprobada/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: 'Enviar nueva solicitud'}));
  fillIdentity();
  acceptConsent();
  send();
  await waitFor(() => expect(screen.getByText(/Queda pendiente/)).toBeInTheDocument());

  const sent = posts().map(([, o]) => JSON.parse(o.body).request_id);
  expect(sent).toHaveLength(1);
  expect(sent[0]).not.toBe('req-rechazado-01');
  expect(sessionStorage.getItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026')).toBe(sent[0]);
});

test('reintento tras error de red reutiliza el mismo request_id (idempotencia)', async () => {
  const sent = [];
  mockFetch.mockImplementation(async (url, opts) => {
    if (opts?.method === 'POST') {
      sent.push(JSON.parse(opts.body).request_id);
      if (sent.length === 1) throw new Error('network');
      return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    }
    return {ok: true, status: 200, json: async () => ({ok: true, requests: []})};
  });
  mount();
  await waitReady();
  fillIdentity();
  acceptConsent();
  send();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos enviar/));
  send();
  await waitFor(() => expect(screen.getByText(/Queda pendiente/)).toBeInTheDocument());
  expect(sent).toHaveLength(2);
  expect(sent[0]).toBe(sent[1]);
});

test('estado de carga de la cuenta no muestra un formulario vacío', () => {
  mockUseAuth.mockReturnValue({session: null, loading: true});
  mount();
  expect(screen.getByRole('status')).toHaveTextContent('Recuperando tu solicitud…');
  expect(document.querySelector('form')).toBeNull();
});

test('copy EN/IT disponible para etiquetas y CTA', async () => {
  mockLanguage = 'en';
  const {unmount} = mount();
  await waitReady('Send request');
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Complete your details for the Nations Cup');
  expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Send request'})).toBeInTheDocument();
  unmount();
  sessionStorage.clear();
  mockLanguage = 'it';
  mount();
  await waitReady('Invia richiesta');
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Completa i tuoi dati per la Nations Cup');
  expect(screen.getByLabelText('Nome e cognome')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Invia richiesta'})).toBeInTheDocument();
});

test('copy de autorizaciones y consulta de solicitud en ES/EN/IT', async () => {
  const copy = {
    es: {
      required: 'Completa los datos y las autorizaciones obligatorias.',
      restore: 'No pudimos consultar tu solicitud. Reintenta en unos minutos.',
      name: 'Nombre y apellido', country: 'País', adult: 'Mayor de edad', button: 'Enviar solicitud',
    },
    en: {
      required: 'Complete the details and required authorisations.',
      restore: 'We could not check your request. Try again in a few minutes.',
      name: 'Full name', country: 'Country', adult: 'Adult', button: 'Send request',
    },
    it: {
      required: 'Completa i dati e le autorizzazioni obbligatorie.',
      restore: 'Non siamo riusciti a controllare la tua richiesta. Riprova tra qualche minuto.',
      name: 'Nome e cognome', country: 'Paese', adult: 'Maggiorenne', button: 'Invia richiesta',
    },
  };
  for (const lang of ['es', 'en', 'it']) {
    mockLanguage = lang;
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const restoreView = mount();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(copy[lang].restore));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/enviar|send|inviare/i);
    restoreView.unmount();
    sessionStorage.clear();

    mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: []})});
    const formView = mount();
    await waitReady(copy[lang].button);
    fireEvent.change(screen.getByLabelText(copy[lang].name), {target: {value: 'Jugador Ficticio'}});
    fireEvent.change(screen.getByLabelText(copy[lang].country), {target: {value: 'IT'}});
    fireEvent.click(screen.getByLabelText(copy[lang].adult));
    fireEvent.click(screen.getByRole('button', {name: copy[lang].button}));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(copy[lang].required);
    expect(alert).not.toHaveTextContent(/edad|\bage\b|età/i);
    expect(posts()).toHaveLength(0);
    formView.unmount();
    sessionStorage.clear();
  }
});

test('dark: textos rojos pequeños usan un tono claro scoped', () => {
  const css = fs.readFileSync(path.join(__dirname, 'NationsInscripcion.css'), 'utf8');
  expect(css).toMatch(/html\.theme-dark \.nations-eyebrow,[\s\S]*?html\.theme-dark \.nations-text-button\s*\{[^}]*color:\s*#ff8d91/i);
  expect(css).toMatch(/html\.theme-dark \.nations-event-chip\s*\{[^}]*color:\s*#ff8d91/i);
});
