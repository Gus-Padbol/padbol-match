/**
 * Web Speech API + parsing de marcador en español (AR) para sets tipo 6-4.
 */

/** @returns {typeof window.SpeechRecognition | null} */
export function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function speechRecognitionDisponible() {
  return Boolean(getSpeechRecognitionConstructor());
}

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Palabras → dígitos (orden largo primero al reemplazar). */
const PALABRA_A_NUMERO_ENTRIES = Object.entries({
  veinte: 20,
  diecinueve: 19,
  dieciocho: 18,
  diecisiete: 17,
  dieciséis: 16,
  dieciseis: 16,
  quince: 15,
  catorce: 14,
  trece: 13,
  doce: 12,
  once: 11,
  diez: 10,
  nueve: 9,
  ocho: 8,
  siete: 7,
  seis: 6,
  cinco: 5,
  cuatro: 4,
  tres: 3,
  dos: 2,
  uno: 1,
  cero: 0,
}).sort((a, b) => b[0].length - a[0].length);

function expandirNumerosPalabrasES(sinAcentosLower) {
  let t = ` ${sinAcentosLower} `;
  for (const [w, n] of PALABRA_A_NUMERO_ENTRIES) {
    const re = new RegExp(`\\b${w}\\b`, 'gi');
    t = t.replace(re, ` ${n} `);
  }
  return t;
}

function extraerDosNumeros(transcript) {
  const base = stripAccents(String(transcript || '').toLowerCase());
  const expanded = expandirNumerosPalabrasES(base);
  const nums = expanded.match(/\d+/g);
  if (!nums || nums.length < 2) return null;
  const a = parseInt(nums[0], 10);
  const b = parseInt(nums[1], 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < 0 || a > 30 || b < 0 || b > 30) return null;
  return [a, b];
}

/**
 * Interpreta frases del estilo "ganamos seis a cuatro" / "perdimos tres a seis"
 * o "6 a 4" (sin pronombre → primer número = equipo A, segundo = B).
 *
 * @param {object} opts
 * @param {string} opts.transcript
 * @param {string|number|null|undefined} opts.equipoAId
 * @param {string|number|null|undefined} opts.equipoBId
 * @param {string|number|null|undefined} opts.miEquipoId - si coincide con B, invierte al formato A-B
 */
export function parseMarcadorVozPartido(opts) {
  const transcript = String(opts?.transcript || '').trim();
  if (!transcript) {
    return { ok: false, error: 'No se escuchó ninguna frase.' };
  }

  const nums = extraerDosNumeros(transcript);
  if (!nums) {
    return {
      ok: false,
      error: 'Decí dos números (ej.: «seis a cuatro» o «6-4»).',
      transcript,
    };
  }

  const [first, second] = nums;
  const t = stripAccents(transcript.toLowerCase());
  const hasGanamos = /\b(ganamos|ganó|gano|gane|gané|vencimos|vencemos)\b/.test(t);
  const hasPerdimos = /\b(perdimos|perd[ií]|perdieron|perdio|perdió)\b/.test(t);

  const aid = opts.equipoAId != null ? String(opts.equipoAId) : '';
  const bid = opts.equipoBId != null ? String(opts.equipoBId) : '';
  const mid = opts.miEquipoId != null ? String(opts.miEquipoId) : '';
  const perspectiveB = Boolean(mid && bid && mid === bid && mid !== aid);

  let aGames;
  let bGames;

  if (!hasGanamos && !hasPerdimos) {
    aGames = first;
    bGames = second;
  } else {
    const ourGames = first;
    const theirGames = second;
    aGames = perspectiveB ? theirGames : ourGames;
    bGames = perspectiveB ? ourGames : theirGames;
  }

  if (aGames === bGames) {
    return {
      ok: false,
      error: 'Los games del set no pueden ser iguales.',
      transcript,
    };
  }

  return {
    ok: true,
    setAB: `${aGames}-${bGames}`,
    transcript,
    tuvoGanamos: hasGanamos,
    tuvoPerdimos: hasPerdimos,
  };
}
