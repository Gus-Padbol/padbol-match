import React from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { STORAGE_KEY } from '../i18n';

const btnBase = {
  border: '1px solid var(--border, rgba(255,255,255,0.25))',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1.2,
  minWidth: 32,
};

export default function LanguageSwitcher({ compact = false, className = '' }) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

  const setLang = (code) => {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={className}
      role="group"
      aria-label={i18n.t('general.language')}
      style={{
        display: 'inline-flex',
        gap: compact ? 2 : 4,
        alignItems: 'center',
      }}
    >
      {(['es', 'en']).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            style={{
              ...btnBase,
              background: active ? 'var(--accent, #e11b22)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary, #94a3b8)',
              opacity: active ? 1 : 0.85,
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
