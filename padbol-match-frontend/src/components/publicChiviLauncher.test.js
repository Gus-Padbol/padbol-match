import fs from 'fs';
import path from 'path';
import { isChatbotIAVisiblePathname } from '../constants/hubLayout';
import { publicLandingKnowledgeAnswer } from './ChatbotIA';

describe('Chivi on the public Padbol Match landing', () => {
  it('is visible on the public landing without expanding to player routes', () => {
    expect(isChatbotIAVisiblePathname('/plataforma')).toBe(true);
    expect(isChatbotIAVisiblePathname('/plataforma/')).toBe(true);
    expect(isChatbotIAVisiblePathname('/jugar')).toBe(false);
    expect(isChatbotIAVisiblePathname('/acceso')).toBe(false);
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
