import fs from 'fs';
import path from 'path';
import { isChatbotIAVisiblePathname } from '../constants/hubLayout';
import {
  bcp47LangForAssistantTts,
  inferWritingLocaleCodeFromText,
  publicLandingKnowledgeAnswer,
} from './ChatbotIA';

describe('Chivi on the public Padbol Match landing', () => {
  it('is visible on the public landing without expanding to player routes', () => {
    expect(isChatbotIAVisiblePathname('/plataforma')).toBe(true);
    expect(isChatbotIAVisiblePathname('/plataforma/')).toBe(true);
    expect(isChatbotIAVisiblePathname('/planes')).toBe(true);
    expect(isChatbotIAVisiblePathname('/jugar')).toBe(false);
    expect(isChatbotIAVisiblePathname('/acceso')).toBe(false);
  });

  it('sends Romanian questions to the Romanian assistant path', () => {
    expect(inferWritingLocaleCodeFromText('Vreau să rezerv un teren mâine')).toBe('ro');
    expect(inferWritingLocaleCodeFromText('Ce turneu este disponibil astăzi?')).toBe('ro');
    expect(inferWritingLocaleCodeFromText('OK', 'de')).toBe('de');
  });

  it('sends explicit public context and renders the AI spark', () => {
    const source = fs.readFileSync(path.join(__dirname, 'ChatbotIA.jsx'), 'utf8');
    const layoutSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'publicSite', 'PublicSiteLayout.jsx'), 'utf8');
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
    expect(source).toContain("client_surface: 'public_landing'");
    expect(source).toContain('chatbot-public-ai-spark');
    expect(source).toContain('¿Qué ofrece a las sedes?');
    expect(layoutSource).toContain('<ChatbotIASafe />');
    expect(appSource).toContain('!publicLayoutOwnsChatbot ? <ChatbotIASafe /> : null');
  });

  it('keeps useful public answers available when the remote AI is unavailable', () => {
    expect(publicLandingKnowledgeAnswer('¿Qué ofrece a las sedes?', 'es')).toMatch(/canchas.*reservas.*torneos/i);
    expect(publicLandingKnowledgeAnswer('¿Tienen reportes contables?', 'es')).toMatch(/no es asesoramiento contable/i);
    expect(publicLandingKnowledgeAnswer('What is available today?', 'en')).toMatch(/available today/i);
    expect(publicLandingKnowledgeAnswer('O que está disponível hoje?', 'pt-BR')).toMatch(/disponíveis hoje/i);
    expect(publicLandingKnowledgeAnswer('Was ist heute verfügbar?', 'de')).toMatch(/Padbol Match connects/i);
    expect(publicLandingKnowledgeAnswer('Ce oferă cluburilor?', 'ro')).toMatch(/terenuri.*rezervări.*turnee/iu);
    expect(publicLandingKnowledgeAnswer('Aveți rapoarte contabile?', 'ro')).toMatch(/nu reprezintă consultanță contabilă/iu);
    expect(publicLandingKnowledgeAnswer('Co nabízíte klubům?', 'cs')).toMatch(/kurtů.*rezervací.*turnajů/iu);
    expect(publicLandingKnowledgeAnswer('Máte účetní přehledy?', 'cs')).toMatch(/Nejde o účetní.*poradenství/iu);
  });

  it('uses the selected language for read-aloud replies', () => {
    expect(bcp47LangForAssistantTts('Vyberte dostupný čas.', 'cs')).toBe('cs-CZ');
    expect(bcp47LangForAssistantTts('Short neutral reply.', 'de')).toBe('de-DE');
    expect(bcp47LangForAssistantTts('Mulțumesc pentru rezervare.', 'en')).toBe('ro-RO');
  });
});
