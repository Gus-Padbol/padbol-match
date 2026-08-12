import {
  chiviSpeechRecognitionLanguage,
  requestChiviMicrophoneAccess,
} from './chiviMicrophone';

describe('Chivi microphone', () => {
  test.each([
    ['es', 'es-AR'],
    ['en', 'en-US'],
    ['fr', 'fr-FR'],
    ['it', 'it-IT'],
    ['ro', 'ro-RO'],
    ['pt-BR', 'pt-BR'],
  ])('uses the selected Padbol Match language (%s)', (language, expected) => {
    expect(chiviSpeechRecognitionLanguage(language)).toBe(expected);
  });

  it('requests audio access and releases the microphone immediately', async () => {
    const stop = jest.fn();
    const getUserMedia = jest.fn().mockResolvedValue({ getTracks: () => [{ stop }] });

    await expect(requestChiviMicrophoneAccess({ getUserMedia })).resolves.toEqual({
      ok: true,
      checked: true,
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('reports a denied browser permission', async () => {
    const error = new Error('denied');
    error.name = 'NotAllowedError';
    const getUserMedia = jest.fn().mockRejectedValue(error);

    await expect(requestChiviMicrophoneAccess({ getUserMedia })).resolves.toEqual({
      ok: false,
      reason: 'denied',
    });
  });
});
