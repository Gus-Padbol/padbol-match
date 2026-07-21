import React, { useEffect } from 'react';
import PublicSiteLayout from './PublicSiteLayout';
import HeroSection from './sections/HeroSection';
import ProblemSection from './sections/ProblemSection';
import EcosystemSection from './sections/EcosystemSection';
import ExperiencesSection from './sections/ExperiencesSection';
import PlayerCycleSection from './sections/PlayerCycleSection';
import VenueOpsSection from './sections/VenueOpsSection';
import CommunitySection from './sections/CommunitySection';
import SmartScoreboardSection from './sections/SmartScoreboardSection';
import TournamentsSection from './sections/TournamentsSection';
import RankingSection from './sections/RankingSection';
import PadCoinsSection from './sections/PadCoinsSection';
import VenueBenefitsSection from './sections/VenueBenefitsSection';
import RolloutSection from './sections/RolloutSection';
import DownloadSection from './sections/DownloadSection';
import ContactSection from './sections/ContactSection';
import './publicSite.css';

const SEO_TITLE = 'Padbol Match | Juego, comunidad y gestión';
const SEO_DESCRIPTION =
  'La plataforma que conecta jugadores, sedes, competencia, fidelización y gestión en una sola experiencia.';

function setTemporaryHeadTag(selector, create) {
  let element = document.head.querySelector(selector);
  const created = !element;
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  const attribute = element.tagName === 'LINK' ? 'href' : 'content';
  const previous = element.getAttribute(attribute);
  return {
    element,
    attribute,
    previous,
    restore() {
      if (created) element.remove();
      else if (previous == null) element.removeAttribute(attribute);
      else element.setAttribute(attribute, previous);
    },
  };
}

function usePublicSiteDocumentMeta() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO_TITLE;
    const canonicalUrl = `${window.location.origin}/plataforma`;
    const tags = [
      ['meta[name="description"]', () => {
        const node = document.createElement('meta');
        node.name = 'description';
        return node;
      }, SEO_DESCRIPTION],
      ['link[rel="canonical"]', () => {
        const node = document.createElement('link');
        node.rel = 'canonical';
        return node;
      }, canonicalUrl],
      ['meta[property="og:title"]', () => {
        const node = document.createElement('meta');
        node.setAttribute('property', 'og:title');
        return node;
      }, SEO_TITLE],
      ['meta[property="og:description"]', () => {
        const node = document.createElement('meta');
        node.setAttribute('property', 'og:description');
        return node;
      }, SEO_DESCRIPTION],
      ['meta[property="og:type"]', () => {
        const node = document.createElement('meta');
        node.setAttribute('property', 'og:type');
        return node;
      }, 'website'],
      ['meta[property="og:url"]', () => {
        const node = document.createElement('meta');
        node.setAttribute('property', 'og:url');
        return node;
      }, canonicalUrl],
      ['meta[name="twitter:card"]', () => {
        const node = document.createElement('meta');
        node.name = 'twitter:card';
        return node;
      }, 'summary'],
      ['meta[name="twitter:title"]', () => {
        const node = document.createElement('meta');
        node.name = 'twitter:title';
        return node;
      }, SEO_TITLE],
      ['meta[name="twitter:description"]', () => {
        const node = document.createElement('meta');
        node.name = 'twitter:description';
        return node;
      }, SEO_DESCRIPTION],
    ].map(([selector, create, value]) => {
      const state = setTemporaryHeadTag(selector, create);
      state.element.setAttribute(state.attribute, value);
      return state;
    });

    const root = document.documentElement;
    root.classList.add('public-site-active');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = themeMeta?.getAttribute('content') ?? null;
    if (themeMeta) themeMeta.setAttribute('content', '#070b14');

    window.scrollTo(0, 0);

    return () => {
      document.title = prevTitle;
      tags.reverse().forEach((tag) => tag.restore());
      root.classList.remove('public-site-active');
      if (themeMeta) {
        if (prevTheme == null) themeMeta.removeAttribute('content');
        else themeMeta.setAttribute('content', prevTheme);
      }
    };
  }, []);
}

export default function PublicSitePage() {
  usePublicSiteDocumentMeta();

  return (
    <PublicSiteLayout>
      <HeroSection />
      <ProblemSection />
      <EcosystemSection />
      <ExperiencesSection />
      <PlayerCycleSection />
      <VenueOpsSection />
      <CommunitySection />
      <SmartScoreboardSection />
      <TournamentsSection />
      <RankingSection />
      <PadCoinsSection />
      <VenueBenefitsSection />
      <RolloutSection />
      <DownloadSection />
      <ContactSection />
    </PublicSiteLayout>
  );
}
