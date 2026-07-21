import React, { useEffect } from 'react';
import PublicSiteLayout from './PublicSiteLayout';
import HeroSection from './sections/HeroSection';
import './publicSite.css';

const SEO_TITLE = 'Padbol Match | Juego, comunidad y gestión';
const SEO_DESCRIPTION =
  'La plataforma que conecta jugadores, sedes, competencia, fidelización y gestión en una sola experiencia.';

function usePublicSiteDocumentMeta() {
  useEffect(() => {
    const prevTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDescription = meta?.getAttribute('content') ?? null;

    document.title = SEO_TITLE;
    if (meta) meta.setAttribute('content', SEO_DESCRIPTION);

    const root = document.documentElement;
    root.classList.add('public-site-active');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = themeMeta?.getAttribute('content') ?? null;
    if (themeMeta) themeMeta.setAttribute('content', '#070b14');

    window.scrollTo(0, 0);

    return () => {
      document.title = prevTitle;
      if (meta) {
        if (prevDescription != null) meta.setAttribute('content', prevDescription);
        else meta.removeAttribute('content');
      }
      root.classList.remove('public-site-active');
      if (themeMeta && prevTheme != null) themeMeta.setAttribute('content', prevTheme);
    };
  }, []);
}

/**
 * Web pública definitiva — etapa 1: scaffold + Hero.
 * Ruta: `/plataforma` (fuera de AppShell).
 */
export default function PublicSitePage() {
  usePublicSiteDocumentMeta();

  return (
    <PublicSiteLayout>
      <HeroSection />

      {/* Anchors seguros para nav/CTAs; secciones completas en etapas siguientes. */}
      <div id="ecosistema" className="public-site-anchor" tabIndex={-1} aria-hidden="true" />
      <div id="jugadores" className="public-site-anchor" tabIndex={-1} aria-hidden="true" />
      <div id="sedes" className="public-site-anchor" tabIndex={-1} aria-hidden="true" />
      <div id="descargar" className="public-site-anchor" tabIndex={-1} aria-hidden="true" />
    </PublicSiteLayout>
  );
}
