import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';
import { commercialFlowCopy } from '../pages/commercialFlowCopy';

const ALL_GOALS_REQUIRED_COPY = {
  en: /50% applies when all monthly goals are met/i,
  es: /50% adicional.*todos los objetivos del mes/i,
  ro: /50%.*îndeplinirea tuturor obiectivelor lunii/i,
  cs: /50%.*splnění všech cílů daného měsíce/i,
  de: /50%.*alle Ziele des Monats erfüllt/i,
  fr: /50%.*tous les objectifs du mois sont atteints/i,
  it: /50%.*tutti gli obiettivi del mese/i,
  ar: /50%.*تحقيق جميع أهداف الشهر/,
  'fa-IR': /50%.*تحقق همه اهداف ماه/,
  'nl-NL': /50%.*alle doelen van de maand zijn behaald/i,
  'nl-BE': /50%.*alle doelen van de maand zijn behaald/i,
  sv: /50%.*alla månadens mål har uppnåtts/i,
  'pt-BR': /50%.*todas as metas do mês/i,
  'pt-PT': /50%.*todos os objetivos do mês/i,
  el: /50%.*όλοι οι στόχοι του μήνα/i,
  hu: /50%.*összes céljának teljesítésekor/i,
  he: /50%.*כל יעדי החודש הושגו/,
  pl: /50%.*wszystkich celów miesiąca/i,
  uk: /50%.*всіх цілей місяця/i,
  af: /50%.*al die maand se doelwitte bereik/i,
};

describe('commercial request localization', () => {
  it('provides direct copy instead of English fallback in every edition', () => {
    const english = commercialFlowCopy('en');
    PADBOL_LANGUAGE_CODES.filter((code) => code !== 'en').forEach((code) => {
      const copy = commercialFlowCopy(code);
      expect(copy.promo.title).not.toBe(english.promo.title);
      expect(copy.promo.formSubtitle).not.toBe(english.promo.formSubtitle);
      ['basePriceLabel', 'basePriceDetail', 'venueServiceLabel', 'lead', 'goalsEyebrow', 'goalsTitle', 'goalsLead', 'supportText', 'outreachTitle', 'outreachText', 'submit', 'success'].forEach((key) => {
        expect(copy.promo[key]).not.toBe(english.promo[key]);
      });
      copy.promo.benefits.forEach((benefit, index) => {
        expect(benefit[1]).not.toBe(english.promo.benefits[index][1]);
        expect(benefit[2]).not.toBe(english.promo.benefits[index][2]);
      });
      [0, 1, 2, 3].forEach((index) => {
        expect(copy.promo.goals[index]).not.toBe(english.promo.goals[index]);
      });
      expect(copy.business.title).not.toBe(english.business.title);
      expect(copy.business.success).not.toBe(english.business.success);
    });
  });

  it('keeps the price sequence and joint goals with app registrations, 8 pairs and scoreboard final closure in all 20 editions', () => {
    PADBOL_LANGUAGE_CODES.forEach((code) => {
      const { promo } = commercialFlowCopy(code);
      expect(promo.venueServiceLabel).toEqual(expect.any(String));
      expect(promo.venueServiceLabel).toContain('Padbol');
      expect(promo.lead).toMatch(/\b3\b/);
      expect(promo.lead).toMatch(/\b34\b/);
      expect(promo.lead).toMatch(/\b68\b/);
      expect(promo.formSubtitle).not.toMatch(/USD|[%$€]|\d/);
      expect(promo.benefits).toHaveLength(3);
      expect(promo.benefits[0][1]).toMatch(/\b3\b/);
      expect(promo.benefits[0].join(' ')).not.toMatch(/\b(?:6|12)\b/);
      expect(promo.benefits[1][1]).toMatch(/50\s*%/);
      expect(promo.benefits[1][2]).toMatch(/\b34\b/);
      expect(promo.benefits[1][2]).toMatch(/\b68\b/);
      expect(promo.benefits[2][1]).toMatch(/50\s*%/);
      expect(promo.benefits[2][2]).toMatch(/\b34\b/);
      expect(promo.benefits[2][2]).toMatch(/\b17\b/);
      expect(promo.goals).toHaveLength(4);
      expect(promo.goals.join(' ')).not.toMatch(/PadCoins/i);
      expect(promo.goals[0]).toMatch(/\b8\b/);
      expect(promo.goals[0]).not.toMatch(/\b16\b/);
      expect(promo.goals[0]).toContain('Padbol Match');
      expect(promo.goals[1]).toContain('Padbol Match');
      expect(promo.goals[1]).not.toMatch(/[%٪]|\b(?:50|100)\b/u);
      expect(promo.goals[1]).not.toMatch(/\b(?:7|15)\b/);
      expect(promo.goals[2]).toMatch(/\b12\b/);
      expect(promo.goals[2]).not.toMatch(/\b10\b/);
      expect(promo.goals[3]).toMatch(/\b10\b/);
      expect(promo.goalsLead.match(/[.!?。؟]/gu)).toHaveLength(1);
      expect(promo.goalsLead).not.toMatch(/USD|\b(?:17|34|68)\b/);
      expect(promo.goalsLead).toMatch(ALL_GOALS_REQUIRED_COPY[code]);
      const recommendation = [promo.outreachTitle, promo.outreachText].join(' ');
      expect(recommendation).not.toMatch(/USD|[%٪$€]|[0-9۰-۹٠-٩]/u);
      expect(recommendation).not.toMatch(/descuento|discount|reduceri|slevy|Rabatt|réduction|sconti|korting|delrabatter|desconto|εκπτώσεις|kedvezmény|הנחות|zniżek|знижок|afslag|تخفیف|خصومات/iu);
    });
  });
});
