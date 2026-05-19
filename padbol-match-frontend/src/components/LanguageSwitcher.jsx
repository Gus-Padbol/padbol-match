import React, { useCallback } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { usePadbolLang } from '../hooks/usePadbolLang';
import { setPadbolLanguage } from '../utils/padbolLang';

/**
 * @param {'header' | 'profile' | 'buttons' | 'landing'} variant
 */
export default function LanguageSwitcher({ variant = 'buttons', compact = false, className = '' }) {
  const { t } = useTranslation();
  const lang = usePadbolLang();
  const resolvedVariant =
    variant === 'buttons' && compact ? 'header' : variant === 'buttons' ? 'buttons' : variant;

  const setLang = useCallback(async (code) => {
    await setPadbolLanguage(code);
  }, []);

  const headerColors =
    resolvedVariant === 'landing'
      ? { base: 'rgba(248, 250, 252, 0.65)', active: '#f8fafc' }
      : { base: 'var(--text-secondary, #94a3b8)', active: 'var(--text-primary, #f8fafc)' };

  if (resolvedVariant === 'header' || resolvedVariant === 'landing') {
    return (
      <div
        className={className}
        role="group"
        aria-label={t('general.language')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: resolvedVariant === 'landing' ? 13 : 11,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '0.02em',
          color: headerColors.base,
          userSelect: 'none',
        }}
      >
        {(['es', 'en']).map((code, idx) => {
          const active = lang === code;
          return (
            <React.Fragment key={code}>
              {idx > 0 ? (
                <span aria-hidden style={{ margin: '0 4px', opacity: 0.45, fontWeight: 500 }}>
                  |
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void setLang(code)}
                aria-pressed={active}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: resolvedVariant === 'landing' ? '4px 5px' : '2px 3px',
                  margin: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 'inherit',
                  fontWeight: active ? 800 : 600,
                  color: active ? headerColors.active : 'inherit',
                  opacity: active ? 1 : 0.75,
                  textDecoration: active ? 'underline' : 'none',
                  textUnderlineOffset: 2,
                }}
              >
                {code.toUpperCase()}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  if (resolvedVariant === 'profile') {
    const profileOptions = [
      { code: 'es', flags: '🇦🇷 🇪🇸', label: 'Español' },
      { code: 'en', flags: '🇺🇸 🇬🇧', label: 'English' },
    ];
    return (
      <div
        className={className}
        role="group"
        aria-label={t('general.language')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
        }}
      >
        {profileOptions.map((opt) => {
          const active = lang === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => void setLang(opt.code)}
              aria-pressed={active}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                border: `2px solid ${active ? 'var(--accent, #e11b22)' : 'var(--border, rgba(255,255,255,0.12))'}`,
                background: active ? 'rgba(225, 27, 34, 0.12)' : 'var(--bg-card, rgba(30,41,59,0.5))',
                color: 'var(--text-primary)',
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
                {opt.flags}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

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

  return (
    <div
      className={className}
      role="group"
      aria-label={t('general.language')}
      style={{
        display: 'inline-flex',
        gap: 4,
        alignItems: 'center',
      }}
    >
      {(['es', 'en']).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => void setLang(code)}
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
