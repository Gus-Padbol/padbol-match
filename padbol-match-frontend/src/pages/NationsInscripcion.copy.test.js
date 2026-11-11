import {COPY} from './NationsInscripcion';

test.each([
  ['es', /^Solicitud recibida\. Tu selección está guardada; no necesitas enviarla otra vez\.$/],
  ['en', /^Registration received\. Your selection is saved; you do not need to send it again\.$/],
  ['it', /^Richiesta ricevuta\. La tua selezione è salvata; non devi inviarla di nuovo\.$/],
  ['pt', /^Solicitação recebida\. Sua seleção está salva; você não precisa enviá-la novamente\.$/],
])('pendingNoteNaples traducido en %s y no cae a español', (lang, expected) => {
  expect(COPY[lang].pendingNoteNaples).toMatch(expected);
  if (lang !== 'es') expect(COPY[lang].pendingNoteNaples).not.toMatch(/Solicitud recibida/);
});
test('PT está completo y no reutiliza pending español', () => {
  expect(COPY.pt).toBeTruthy();
  expect(COPY.pt.eyebrow).toMatch(/Inscrição/);
  expect(COPY.pt.pendingNoteNaples).not.toMatch(/Solicitud recibida/);
  for (const key of Object.keys(COPY.es)) expect(COPY.pt[key]).toBeDefined();
});
