import React, { useEffect, useRef } from 'react';
import PublicSiteLayout from './PublicSiteLayout';
import HeroSection from './sections/HeroSection';
import ExperiencesSection from './sections/ExperiencesSection';
import {
  WhatIsSection,
  PlayerPathSection,
  PlayerRecordSection,
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

export default function PublicSitePage() {
  usePublicSiteDocumentMeta();
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
