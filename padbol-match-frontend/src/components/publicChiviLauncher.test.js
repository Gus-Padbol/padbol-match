import fs from 'fs';
import path from 'path';
import { isChatbotIAVisiblePathname } from '../constants/hubLayout';
import { publicLandingKnowledgeAnswer } from './ChatbotIA';

describe('Chivi on the public Padbol Match landing', () => {
  it('is visible on the public landing without expanding to player routes', () => {
    expect(isChatbotIAVisiblePathname('/plataforma')).toBe(true);
    expect(isChatbotIAVisiblePathname('/plataforma/')).toBe(true);
    expect(isChatbotIAVisiblePathname('/administradores')).toBe(true);
    expect(isChatbotIAVisiblePathname('/jugar')).toBe(false);
    expect(isChatbotIAVisiblePathname('/acceso')).toBe(false);
  });

  it('preserves the approved attention cycle and scoreboard media fallback', () => {
    const source = fs.readFileSync(path.join(__dirname, 'ChatbotIA.jsx'), 'utf8');
    const styles = fs.readFileSync(path.join(__dirname, 'ChatbotIA.css'), 'utf8');
    const premiumSections = fs.readFileSync(path.join(__dirname, '..', 'pages', 'publicSite', 'sections', 'PremiumSections.jsx'), 'utf8');
    const publicStyles = fs.readFileSync(path.join(__dirname, '..', 'pages', 'publicSite', 'publicSite.css'), 'utf8');

    expect(source).toContain("p === '/administradores'");
    expect(source).toContain('window.innerHeight * 3');
    expect(styles).toContain('chatbot-public-float 0.7s ease-in-out 3');
    expect(styles).toContain('chatbot-public-avatar-collapse 0.35s ease 2.1s forwards');
    expect(styles).toContain('chatbot-public-label-collapse 0.3s ease 2.02s forwards');
    expect(premiumSections).toContain('<ScoreboardSnapshot />');
    expect(premiumSections).toContain('<ScoreboardVideo text={text} />');
    expect(publicStyles).toContain('.ps-section--scoreboard .ps-scoreboard__snapshot {\n    display: block;');
  });

  it('sends explicit public context and renders the AI spark', () => {
    const source = fs.readFileSync(path.join(__dirname, 'ChatbotIA.jsx'), 'utf8');
    const layoutSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'publicSite', 'PublicSiteLayout.jsx'), 'utf8');
    expect(source).toContain("client_surface: 'public_landing'");
    expect(source).toContain('chatbot-public-ai-spark');
    expect(source).toContain('¿Qué ofrece a las sedes?');
    expect(layoutSource).toContain('<ChatbotIASafe />');
  });

  it('keeps useful public answers available when the remote AI is unavailable', () => {
    expect(publicLandingKnowledgeAnswer('¿Qué ofrece a las sedes?', 'es')).toMatch(/canchas.*reservas.*torneos/i);
    expect(publicLandingKnowledgeAnswer('¿Tienen reportes contables?', 'es')).toMatch(/no es asesoramiento contable/i);
    expect(publicLandingKnowledgeAnswer('What is available today?', 'en')).toMatch(/available today/i);
  });
});
