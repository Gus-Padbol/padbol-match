import { chooseChiviVoice } from './chiviVoice';

describe('Chivi voice selection', () => {
  it('prioritizes a masculine voice in the response language', () => {
    const voices = [
      { name: 'Monica', lang: 'es-ES', localService: true },
      { name: 'Diego Enhanced', lang: 'es-AR', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
    ];
    expect(chooseChiviVoice(voices, 'es-AR')).toBe(voices[1]);
  });

  it('never chooses a voice from another language', () => {
    const voices = [
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Google français', lang: 'fr-FR' },
    ];
    expect(chooseChiviVoice(voices, 'fr-FR')).toBe(voices[1]);
  });
});
