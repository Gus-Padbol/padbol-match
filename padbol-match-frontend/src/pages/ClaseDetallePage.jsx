import React, { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import ClaseDetalle from '../components/Clases/ClaseDetalle';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';

export default function ClaseDetallePage() {
  const { id } = useParams();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const claseId = useMemo(() => Number(id), [id]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Detalle de clase" />
      <main style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '16px 14px 24px', boxSizing: 'border-box' }}>
        <ClaseDetalle claseId={claseId} />
      </main>
      <BottomNav />
    </div>
  );
}
