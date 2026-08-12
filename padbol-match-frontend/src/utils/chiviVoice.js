const MALE_VOICE_NAMES = [
  'diego', 'jorge', 'marcelo', 'carlos', 'juan', 'pablo', 'alvaro', 'álvaro',
  'daniel', 'thomas', 'arthur', 'guy', 'ryan', 'aaron', 'alex', 'luca', 'cosimo',
  'andrei', 'felipe', 'antonio', 'antónio', 'ricardo', 'maged', 'tarik', 'xander',
];

const FEMALE_VOICE_NAMES = [
  'mónica', 'monica', 'paulina', 'samantha', 'victoria', 'karen', 'moira', 'amelie',
  'amélie', 'alice', 'anna', 'helena', 'joana', 'luciana', 'mariska', 'milena',
];

function baseLanguage(value) {
  return String(value || '').toLowerCase().split('-')[0];
}

export function chooseChiviVoice(voices, targetLanguage) {
  const list = Array.isArray(voices) ? voices : [];
  const target = String(targetLanguage || '').toLowerCase();
  const targetBase = baseLanguage(target);
  const candidates = list.filter((voice) => baseLanguage(voice?.lang) === targetBase);
  if (!candidates.length) return null;

  return candidates
    .map((voice, index) => {
      const name = String(voice?.name || '').toLowerCase();
      const language = String(voice?.lang || '').toLowerCase();
      let score = language === target ? 100 : 55;
      if (MALE_VOICE_NAMES.some((maleName) => name.includes(maleName))) score += 80;
      if (FEMALE_VOICE_NAMES.some((femaleName) => name.includes(femaleName))) score -= 80;
      if (/premium|enhanced|neural|natural|google|microsoft/.test(name)) score += 30;
      if (voice?.localService) score += 5;
      return { voice, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].voice;
}
