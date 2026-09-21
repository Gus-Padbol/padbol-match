import fs from 'fs';
import path from 'path';
import { venuePlansCopy } from '../pages/adminLanding/venuePlansCopy';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';
import commercialPlansKnowledge from '../config/commercialPlansKnowledge.json';

describe('venue plans localization', () => {
  it('provides a complete, natural Romanian commercial page', () => {
    const ro = venuePlansCopy('ro');
    expect(ro.title).toBe('Întregul tău club.');
    expect(ro.padbolOwnerTitle).toContain('Padbol Courts');
    expect(ro.plans.starter.features).toHaveLength(10);
    expect(ro.plans.pro.features).toHaveLength(9);
    expect(ro.plans.business.features).toHaveLength(7);
    expect(ro.membershipText).toMatch(/prețul.*rezervările incluse.*PadCoins/iu);
    expect(ro.faqs).toHaveLength(6);
    expect(ro.faqHelpTitle).toBe('Mai ai întrebări?');
  });

  it('provides direct copy instead of English fallback in every edition', () => {
    const english = venuePlansCopy('en');
    PADBOL_LANGUAGE_CODES.filter((code) => !['en'].includes(code)).forEach((code) => {
      const copy = venuePlansCopy(code);
      expect(copy.title).not.toBe(english.title);
      expect(copy.lead).not.toBe(english.lead);
      expect(copy.faqHelpText).not.toBe(english.faqHelpText);
      ['padbolOwnerText', 'padbolOwnerHint', 'padbolOwnerCta'].forEach((field) => {
        expect(copy[field]).not.toBe(english[field]);
        const placeholders = (text) => (text.match(/\{\{[^}]+\}\}/g) || []).sort();
        expect(placeholders(copy[field])).toEqual(placeholders(english[field]));
      });
    });
    expect(venuePlansCopy('es').title).toBe('Todo tu club.');
  });

  it('uses the same Spanish and English commercial FAQ source as Chivi', () => {
    expect(venuePlansCopy('es').faqs).toEqual(commercialPlansKnowledge.es.faqs);
    expect(venuePlansCopy('en').faqs).toEqual(commercialPlansKnowledge.en.faqs);
  });

  it('provides a complete direct Czech commercial page', () => {
    const cs = venuePlansCopy('cs');
    expect(cs.title).toBe('Celý váš klub.');
    expect(cs.start).toBe('ZAČÍT BEZ PAUŠÁLU');
    expect(cs.padbolOwnerTitle).toContain('Padbol Courts');
    expect(cs.plans.starter.features).toHaveLength(10);
    expect(cs.plans.pro.features).toHaveLength(9);
    expect(cs.plans.business.features).toHaveLength(7);
  });

  it('keeps Brazilian and European Portuguese as distinct direct editions', () => {
    const brazil = venuePlansCopy('pt-BR');
    const portugal = venuePlansCopy('pt-PT');
    expect(brazil.title).toBe('Todo o seu clube.');
    expect(brazil.plans.starter.features[2]).toContain('quadras');
    expect(portugal.plans.starter.features[2]).toContain('campos');
    expect(portugal.plans.starter.features[6]).toContain('ecrã');
    expect(portugal.sports).toContain('Ténis');
    expect(portugal.devices).toContain('Telemóvel');
    expect(brazil.plans.pro.features).toHaveLength(9);
    expect(portugal.plans.business.features).toHaveLength(7);
  });

  it('provides a complete direct Italian commercial page', () => {
    const it = venuePlansCopy('it');
    expect(it.title).toBe('Tutto il tuo club.');
    expect(it.start).toBe('INIZIA SENZA CANONE');
    expect(it.padbolOwnerTitle).toContain('Padbol Courts');
    expect(it.plans.starter.features).toHaveLength(10);
    expect(it.plans.pro.features).toHaveLength(9);
    expect(it.plans.business.features).toHaveLength(7);
  });

  it('provides a complete direct French commercial page', () => {
    const fr = venuePlansCopy('fr');
    expect(fr.title).toBe('Tout votre club.');
    expect(fr.start).toBe('COMMENCER SANS ABONNEMENT');
    expect(fr.padbolOwnerTitle).toContain('Padbol Courts');
    expect(fr.plans.starter.features).toHaveLength(10);
    expect(fr.plans.pro.features).toHaveLength(9);
    expect(fr.plans.business.features).toHaveLength(7);
  });

  it('provides a complete direct German commercial page', () => {
    const de = venuePlansCopy('de');
    expect(de.title).toBe('Ihr gesamter Club.');
    expect(de.start).toBe('OHNE MONATSGEBÜHR STARTEN');
    expect(de.padbolOwnerTitle).toContain('Padbol Courts');
    expect(de.plans.starter.features).toHaveLength(10);
    expect(de.plans.pro.features).toHaveLength(9);
    expect(de.plans.business.features).toHaveLength(7);
  });

  it('keeps visible copy out of the page component', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'pages', 'adminLanding', 'VenuePlansPage.jsx'),
      'utf8',
    );
    expect(source).not.toContain('Reservas, jugadores, partidos');
    expect(source).not.toContain('BENEFICIO EXCLUSIVO PARA SEDES');
    expect(source).not.toContain('CREÁ TU PROPIA MEMBRESÍA');
    expect(source).not.toContain('¿Hay cargos ocultos?');
    expect(source).not.toContain('PREGUNTALE A CHIVI');
  });

  it('invites clubs to discover their benefits without prices, percentages or trial terms in every edition', () => {
    PADBOL_LANGUAGE_CODES.forEach((language) => {
      const copy = venuePlansCopy(language);
      ['padbolOwnerText', 'padbolOwnerHint', 'padbolOwnerCta'].forEach((field) => {
        expect(copy[field]).not.toMatch(/[\d%٪$€]|USD|\b(?:gratis|free|gratuit\w*|kostenlos\w*|gratuit\w*|ingyenes|gratuites|δωρεάν|безкоштовн\w*|bezpłatn\w*|zdarma)\b|رایگان|مجاني|مجانية|ללא תשלום/iu);
      });
    });
    expect(venuePlansCopy('es').padbolOwnerText).toBe('Descubre los beneficios exclusivos de Padbol Match para tu sede.');
    expect(venuePlansCopy('es').padbolOwnerCta).toBe('PIDE TUS BENEFICIOS');
  });
});
