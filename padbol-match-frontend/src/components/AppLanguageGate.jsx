import { useEffect } from 'react';
import { bootstrapPadbolLanguage } from '../utils/padbolLang';

/**
 * Inicializa idioma al arrancar: `padbol_lang` guardado o inglés por defecto (landing internacional).
 * No bloquea la app; la elección explícita se hace en landing / header / perfil.
 */
export default function AppLanguageGate({ children }) {
  useEffect(() => {
    bootstrapPadbolLanguage();
  }, []);

  return children;
}
