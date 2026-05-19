import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { usePadbolI18n } from '../context/PadbolI18nContext';
import { PADBOL_LANGUAGES } from '../constants/padbolLanguages';
import './LanguageSwitcher.css';

function TablerWorldIcon({ size = 18 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M3.6 9h16.8" />
      <path d="M3.6 15h16.8" />
      <path d="M11.5 3a17 17 0 0 0 0 18" />
      <path d="M12.5 3a17 17 0 0 1 0 18" />
    </svg>
  );
}

function ChevronDownIcon({ size = 12 }) {
  return (
    <svg
      className="lang-switcher__chevron"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Selector de idioma compacto (globo + menú). Escalar agregando entradas en {@link PADBOL_LANGUAGES}.
 * @param {'header' | 'profile' | 'landing' | 'buttons'} variant
 */
export default function LanguageSwitcher({ variant = 'header', compact = false, className = '' }) {
  const { t } = useTranslation();
  const { language: lang, setLanguage } = usePadbolI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  const resolvedVariant =
    variant === 'buttons' && compact ? 'header' : variant === 'buttons' ? 'header' : variant;

  const setLang = useCallback(
    async (code) => {
      await setLanguage(code);
      setOpen(false);
    },
    [setLanguage],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const shellClass = [
    'lang-switcher',
    resolvedVariant === 'landing' ? 'lang-switcher--landing' : '',
    resolvedVariant === 'profile' ? 'lang-switcher--profile' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass} ref={rootRef}>
      <button
        type="button"
        className="lang-switcher__trigger"
        aria-label={t('general.language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <TablerWorldIcon size={resolvedVariant === 'landing' ? 17 : 16} />
        <ChevronDownIcon size={11} />
      </button>
      {open ? (
        <ul id={listId} className="lang-switcher__menu" role="listbox" aria-label={t('general.language')}>
          {PADBOL_LANGUAGES.map((opt) => {
            const active = lang === opt.code;
            return (
              <li key={opt.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`lang-switcher__option${active ? ' lang-switcher__option--active' : ''}`}
                  onClick={() => void setLang(opt.code)}
                >
                  <span className="lang-switcher__flags" aria-hidden>
                    {opt.flags}
                  </span>
                  <span className="lang-switcher__label">{opt.label}</span>
                  {active ? (
                    <span className="lang-switcher__check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
