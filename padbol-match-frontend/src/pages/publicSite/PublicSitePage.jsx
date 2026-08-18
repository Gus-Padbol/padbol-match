import React, { useEffect, useLayoutEffect, useRef } from 'react';
import PublicSiteLayout from './PublicSiteLayout';
import HeroSection from './sections/HeroSection';
import ExperiencesSection from './sections/ExperiencesSection';
import {
  WhatIsSection,
  PlayerPathSection,
  PlayerRecordSection,
  CommunityMatchesSection,
  VenuePathSection,
  VenueAdminSection,
  ContinuitySection,
  SmartScoreboardSection,
  MatchIntelligenceSection,
  AboutSection,
  DownloadSection,
  ContactSection,
} from './sections/PremiumSections';
import useRevealOnScroll from './useRevealOnScroll';
import './publicSite.css';

function usePublicSiteDocumentMeta() {
  useEffect(() => {
    const prevTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const theme = document.querySelector('meta[name="theme-color"]');
    const prevDescription = description?.getAttribute('content') || '';
    const prevTheme = theme?.getAttribute('content') || '';

    document.title = 'Padbol Match — Plataforma';
    description?.setAttribute(
      'content',
      'Padbol Match conecta jugadores, sedes y organizaciones para gestionar Padbol, Pádel, Pickleball y Tenis en una sola plataforma.',
    );
    theme?.setAttribute('content', '#0a0c12');
    document.documentElement.classList.add('public-site-active');

    return () => {
      document.title = prevTitle;
      description?.setAttribute('content', prevDescription);
      theme?.setAttribute('content', prevTheme);
      document.documentElement.classList.remove('public-site-active');
    };
  }, []);
}

/**
 * La web oficial de Padbol llega desde otro sitio. En algunos navegadores se
 * restaura la posición anterior del documento y la plataforma abría en el
 * footer. Esta ruta siempre debe empezar por el hero.
 */
function usePlatformEntryAtTop() {
  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, []);
}

export default function PublicSitePage() {
  usePublicSiteDocumentMeta();
  usePlatformEntryAtTop();
  const revealRootRef = useRef(null);
  useRevealOnScroll(revealRootRef);

  return (
    <PublicSiteLayout>
      <div ref={revealRootRef} className="public-site__reveal-root">
        <HeroSection />
        <WhatIsSection />
        <ExperiencesSection />
        <PlayerPathSection />
        <PlayerRecordSection />
        <CommunityMatchesSection />
        <SmartScoreboardSection />
        <ContinuitySection />
        <VenuePathSection />
        <VenueAdminSection />
        <MatchIntelligenceSection />
        <AboutSection />
        <DownloadSection />
        <ContactSection />
      </div>
    </PublicSiteLayout>
  );
}
