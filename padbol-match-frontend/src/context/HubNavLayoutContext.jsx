import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { HUB_NAV_DOCK_BOTTOM_BREAKPOINT_PX } from '../constants/hubLayout';

const HubNavLayoutContext = createContext({ navDock: 'top' });

const mqBottomDock =
  typeof window !== 'undefined'
    ? window.matchMedia(`(max-width: ${HUB_NAV_DOCK_BOTTOM_BREAKPOINT_PX}px)`)
    : null;

export function HubNavLayoutProvider({ children }) {
  const [navDock, setNavDock] = useState(() => (mqBottomDock?.matches ? 'bottom' : 'top'));

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${HUB_NAV_DOCK_BOTTOM_BREAKPOINT_PX}px)`);
    const onChange = () => setNavDock(mql.matches ? 'bottom' : 'top');
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const value = useMemo(() => ({ navDock }), [navDock]);
  return <HubNavLayoutContext.Provider value={value}>{children}</HubNavLayoutContext.Provider>;
}

export function useHubNavLayout() {
  return useContext(HubNavLayoutContext);
}
