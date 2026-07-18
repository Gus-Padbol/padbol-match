import React from 'react';
import { useNavigate } from 'react-router-dom';
import PadbolBrandLogo from './PadbolBrandLogo';
import { useAuth } from '../context/AuthContext';
import { PADBOL_LANGUAGES } from '../constants/padbolLanguages';
import { setPadbolLanguage } from '../utils/padbolLang';
import { scheduleHubEntryScrollReset } from '../utils/hubEntryScrollReset';
import './LanguageSelectScreen.css';

/**
 * Primera apertura: el usuario debe elegir idioma antes del resto de la app.
 */
export default function LanguageSelectScreen({ onComplete }) {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const handlePick = async (code) => {
    await setPadbolLanguage(code);
    onComplete?.();
    if (!loading && session?.user) {
      navigate('/hub', { replace: true });
      scheduleHubEntryScrollReset();
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <div
      className="language-select-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Language selection"
    >
      <div className="language-select-screen__inner">
        <PadbolBrandLogo className="language-select-screen__logo" />

        <div className="language-select-screen__actions">
          {PADBOL_LANGUAGES.map((opt) => (
            <button
              key={opt.code}
              type="button"
              className="language-select-screen__btn"
              onClick={() => void handlePick(opt.code)}
              aria-label={opt.label}
            >
              <span className="language-select-screen__flags" aria-hidden>
                {opt.flags}
              </span>
              <span className="language-select-screen__label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
