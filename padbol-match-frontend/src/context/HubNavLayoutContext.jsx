import React, { createContext, useContext, useMemo } from 'react';

const HubNavLayoutContext = createContext({ navDock: 'bottom' });

/**
 * Barra Perfil / Jugar / Competir / Notificaciones siempre anclada abajo del viewport
 * (móvil y desktop). El padding de contenido usa {@link hubMainPaddingBottomCss}.
 */
export function HubNavLayoutProvider({ children }) {
  const value = useMemo(() => ({ navDock: 'bottom' }), []);
  return <HubNavLayoutContext.Provider value={value}>{children}</HubNavLayoutContext.Provider>;
}

export function useHubNavLayout() {
  return useContext(HubNavLayoutContext);
}
