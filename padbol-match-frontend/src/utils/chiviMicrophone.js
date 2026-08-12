import { padbolLangToIntlLocale } from './padbolLang';

export function chiviSpeechRecognitionLanguage(padbolLang) {
  return padbolLangToIntlLocale(padbolLang);
}

export async function requestChiviMicrophoneAccess(mediaDevices) {
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    return { ok: true, checked: false };
  }

  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream?.getTracks?.().forEach((track) => track.stop());
    return { ok: true, checked: true };
  } catch (error) {
    const name = String(error?.name || '');
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { ok: false, reason: 'denied' };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, reason: 'missing' };
    }
    return { ok: false, reason: 'unavailable' };
  }
}
