import { useCallback } from 'react';
import { useSafeTranslation as useBaseTranslation } from './tSafe';

export function stripAdminEmoji(value) {
  return typeof value === 'string'
    ? value.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u200B]/gu,
      (character) => ['©', '®', '™'].includes(character) ? character : '').trim()
    : value;
}

export function useSafeTranslation(...args) {
  const translation = useBaseTranslation(...args);
  const baseT = translation.t;
  const t = useCallback((...values) => {
    const value = baseT(...values);
    if (typeof value !== 'string') return value;
    const success = typeof value === 'string' && value.startsWith('\u2705');
    return `${success ? '\u200B' : ''}${stripAdminEmoji(value)}`;
  }, [baseT]);
  return { ...translation, t };
}
