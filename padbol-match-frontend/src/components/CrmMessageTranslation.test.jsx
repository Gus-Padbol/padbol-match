import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CrmMessageTranslation, { detectLikelyLanguage, shouldOfferTranslation } from './CrmMessageTranslation';

const samples = {
  en: 'Hello, I represent a sports club in Miami and would like to know the price for a Padbol court.',
  de: 'Guten Tag, wir betreiben eine Sportanlage in Berlin und interessieren uns für den Preis einer Padbol-Anlage.',
  fr: "Bonjour, nous sommes un club de sport à Lyon et nous souhaitons connaître le prix d'un terrain de Padbol.",
  ro: 'Bună ziua, suntem un club sportiv din București și dorim să aflăm prețul unui teren de Padbol.',
  pt: 'Olá, somos um clube esportivo em Lisboa e gostaríamos de saber o preço de uma quadra de Padbol.',
};

test('detecta y ofrece traducción para inglés, alemán, francés, rumano y portugués', () => {
  for (const [language, text] of Object.entries(samples)) {
    expect(detectLikelyLanguage(text)).toBe(language);
    expect(shouldOfferTranslation(text)).toBe(true);
  }
});

test('no ofrece traducción para un mensaje en español', () => {
  const spanish = 'Hola, somos un club deportivo en Madrid y queremos saber el precio de una cancha de Padbol.';
  expect(detectLikelyLanguage(spanish)).toBe('es');
  expect(shouldOfferTranslation(spanish)).toBe(false);
});

test('muestra la traducción y permite volver al original sin modificarlo', async () => {
  const original = samples.en;
  const api = { translateMessage: jest.fn().mockResolvedValue({ translation: 'Hola, represento a un club deportivo en Miami y quisiera saber el precio de una cancha de Padbol.', cached: false, originalUnchanged: true }) };
  render(<CrmMessageTranslation api={api} text={original} messageId="m1" channel="email" caseId="c1" />);
  fireEvent.click(screen.getByRole('button', { name: /Traducir al español/i }));
  await waitFor(() => expect(screen.getByText(/represento a un club deportivo/i)).toBeInTheDocument());
  expect(screen.queryByText(original)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ver original/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Ver original/i }));
  expect(screen.getByText(original)).toBeVisible();
  expect(api.translateMessage).toHaveBeenCalledWith(expect.objectContaining({ text: original, channel: 'email', caseId: 'c1' }));
});

test('muestra error real y no cambia el original si falla la traducción', async () => {
  const original = samples.de;
  const api = { translateMessage: jest.fn().mockRejectedValue(Object.assign(new Error('Servicio no disponible'), { code: 'TRANSLATION_UNAVAILABLE' })) };
  render(<CrmMessageTranslation api={api} text={original} messageId="m2" channel="whatsapp" caseId="c2" />);
  fireEvent.click(screen.getByRole('button', { name: /Traducir al español/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Servicio no disponible'));
  expect(screen.getByText(original)).toBeVisible();
});
