import React, { useCallback, useState } from 'react';
import { hasPadbolLangChosen } from '../utils/padbolLang';
import LanguageSelectScreen from './LanguageSelectScreen';

/**
 * Bloquea el resto de la app hasta que exista `padbol_lang` en localStorage.
 */
export default function AppLanguageGate({ children }) {
  const [langChosen, setLangChosen] = useState(() => hasPadbolLangChosen());

  const handleLanguageChosen = useCallback(() => {
    setLangChosen(true);
  }, []);

  if (!langChosen) {
    return <LanguageSelectScreen onComplete={handleLanguageChosen} />;
  }

  return children;
}
