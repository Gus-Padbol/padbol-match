import {COPY} from './NationsInscripcion';

const expected = {
  es: {badge: /^Recibida$/, pending: /^Registro recibido\./, note: /^Solicitud recibida\. Tu selección está guardada; no necesitas enviarla otra vez\.$/},
  en: {badge: /^Received$/, pending: /^Registration submitted\./, note: /^Registration received\. Your selection is saved; you do not need to send it again\.$/},
  it: {badge: /^Ricevuta$/, pending: /^Richiesta ricevuta\./, note: /^Richiesta ricevuta\. La tua selezione è salvata; non devi inviarla di nuovo\.$/},
  pt: {badge: /^Recebida$/, pending: /^Solicitação recebida\./, note: /^Solicitação recebida\. Sua seleção está salva; você não precisa enviar novamente\.$/},
};

test.each(Object.entries(expected))('%s define badge, heading y note Napoli traducidos', (lang, words) => {
  expect(COPY[lang].pendingBadgeNaples).toMatch(words.badge);
  expect(COPY[lang].pendingNaples).toMatch(words.pending);
  expect(COPY[lang].pendingNoteNaples).toMatch(words.note);
  if (lang !== 'es') {
    expect(COPY[lang].pendingNoteNaples).not.toMatch(/Solicitud recibida/);
    expect(COPY[lang].pendingNaples).not.toBe(COPY.es.pendingNaples);
    expect(COPY[lang].pendingBadgeNaples).not.toBe(COPY.es.pendingBadgeNaples);
  }
});

test('PT está completo y no reutiliza pending español', () => {
  expect(COPY.pt).toBeTruthy();
  expect(COPY.pt.eyebrow).toMatch(/Inscrição/);
  expect(COPY.pt.pendingNoteNaples).not.toMatch(/Solicitud recibida/);
  for (const key of Object.keys(COPY.es)) expect(COPY.pt[key]).toBeDefined();
});
