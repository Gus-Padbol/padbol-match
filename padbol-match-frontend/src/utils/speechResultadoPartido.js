/**
 * Web Speech API + parsing de marcador completo (mejor de 3 sets) en español (AR).
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

/** Quita palabras de relleno; no altera los dígitos. */
function enmascararPalabrasIgnoradas(sinAcentosLower) {
  let t = ` ${sinAcentosLower} `;
  const ignorar = [
    'coma',
    'set',
    'sets',
    'primer',
    'primera',
    'primero',
    'segundo',
    'segunda',
    'tercero',
    'tercera',
    'cuarto',
    'cuarta',
    'guion',
    'guion medio',
    'a',
    'y',
    'el',
    'la',
    'los',
    'las',
    'con',
    'por',
  ];
  for (const w of ignorar) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    t = t.replace(re, ' ');
  }
  return t;
}

/**
 * Extrae enteros en orden (0–99 por dígitos; palabras expandidas antes).
 * @param {string} transcript
 * @returns {number[]}
 */
export function extraerSecuenciaNumerosMarcador(transcript) {
  const base = stripAccents(String(transcript || '').toLowerCase());
  const masked = enmascararPalabrasIgnoradas(base);
  const expanded = expandirNumerosPalabrasES(masked);
  const chunks = expanded.match(/\d+/g);
  if (!chunks || chunks.length === 0) return [];
  return chunks.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
}

/**
 * Valida mejor de 3: 2 o 3 sets; ganador con exactamente 2 sets; sin set decisivo de más.
 * @param {{ a: number, b: number }[]} sets
 * @returns {{ ok: true, winsA: number, winsB: number } | { ok: false, error: string }}
 */
export function validarMejorDeTres(sets) {
  if (!sets || sets.length < 2) {
    return { ok: false, error: 'Se necesitan al menos 2 sets (cuatro números: juegos de A y B por set).' };
  }
  if (sets.length > 3) {
    return { ok: false, error: 'Como máximo 3 sets (seis números).' };
  }

  let winsA = 0;
  let winsB = 0;

  for (let i = 0; i < sets.length; i += 1) {
    const { a, b } = sets[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return { ok: false, error: 'Números de games inválidos en un set.' };
    }
    if (a < 0 || a > 7 || b < 0 || b > 7) {
      return { ok: false, error: 'Los games de cada set deben estar entre 0 y 7.' };
    }
    if (a === b) {
      return { ok: false, error: 'No puede haber empate en un set (decí un ganador por set).' };
    }
    if (a > b) winsA += 1;
    else winsB += 1;

    if (i === 1 && sets.length === 3 && (winsA === 2 || winsB === 2)) {
      return {
        ok: false,
        error:
          'El partido ya estaba definido en 2 sets (2-0). No hace falta dictar un tercer set.',
      };
    }
  }

  if (sets.length === 2) {
    if ((winsA === 2 && winsB === 0) || (winsB === 2 && winsA === 0)) {
      return { ok: true, winsA, winsB };
    }
    return {
      ok: false,
      error: 'Con 2 sets el marcador debe ser 2-0 para un equipo (ej.: 6-4 y 6-2).',
    };
  }

  if ((winsA === 2 && winsB === 1) || (winsB === 2 && winsA === 1)) {
    return { ok: true, winsA, winsB };
  }

  return {
    ok: false,
    error:
      'Con 3 sets el resultado debe ser 2-1 (un equipo gana dos sets y el otro uno). Revisá los números.',
  };
}

/**
 * Dictado en una sola frase: pares consecutivos = sets (A = local / equipo izquierda, B = visitante).
 *
 * @param {string} transcript
 * @returns {object}
 */
export function parseMarcadorVozPartidoCompleto(transcript) {
  const raw = String(transcript || '').trim();
  if (!raw) {
    return { ok: false, error: 'No se escuchó ninguna frase.' };
  }

  const nums = extraerSecuenciaNumerosMarcador(raw);
  if (nums.length === 0) {
    return {
      ok: false,
      error: 'No se detectaron números. Ej.: «6 4, 3 6, 7 5» o «6 4 3 6».',
      transcript: raw,
    };
  }

  if (nums.length > 6) {
    return {
      ok: false,
      error: 'Demasiados números. Como máximo 6 (tres sets).',
      transcript: raw,
    };
  }

  if (nums.length % 2 !== 0) {
    return {
      ok: false,
      error: 'Falta un número para completar el último set (necesitas pares: A y B por set).',
      transcript: raw,
    };
  }

  const sets = [];
  for (let i = 0; i < nums.length; i += 2) {
    sets.push({ a: nums[i], b: nums[i + 1] });
  }

  const val = validarMejorDeTres(sets);
  if (!val.ok) {
    return { ok: false, error: val.error, transcript: raw, sets };
  }

  const winnerSide = val.winsA === 2 ? 'A' : 'B';
  const norm = {
    set1: `${sets[0].a}-${sets[0].b}`,
    set2: `${sets[1].a}-${sets[1].b}`,
    set3: sets[2] ? `${sets[2].a}-${sets[2].b}` : '',
  };

  const resumenSets = sets.map((s, idx) => `Set ${idx + 1}: ${s.a}-${s.b}`).join(' | ');

  return {
    ok: true,
    sets,
    norm,
    winnerSide,
    resumenSets,
    transcript: raw,
    winsA: val.winsA,
    winsB: val.winsB,
  };
}

/**
 * @deprecated Usar {@link parseMarcadorVozPartidoCompleto} para dictado del partido completo.
 * Interpreta una frase con dos números (un solo set).
 */
export function parseMarcadorVozPartido(opts) {
  const transcript = String(opts?.transcript || '').trim();
  if (!transcript) {
    return { ok: false, error: 'No se escuchó ninguna frase.' };
  }

  const nums = extraerSecuenciaNumerosMarcador(transcript);
  if (nums.length < 2) {
    return {
      ok: false,
      error: 'Decí dos números (ej.: «seis a cuatro» o «6-4»).',
      transcript,
    };
  }

  const first = nums[0];
  const second = nums[1];
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
