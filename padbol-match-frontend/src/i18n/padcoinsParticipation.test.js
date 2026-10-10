import i18next from 'i18next';
import { getLocaleFallbacks } from './tSafe';
test.each(['es','en'])('participation counter renders total number of venues in %s', async language => {
 const i18n=i18next.createInstance();
 await i18n.init({lng:language,resources:{[language]:{translation:getLocaleFallbacks(language)}},keySeparator:false});
 const text=i18n.t('admin.padcoins.sedeParticipationListCount',{count:4});
 expect(text).toContain('4');expect(text).not.toMatch(/\{\{/);
 expect(i18n.t('admin.padcoins.sedeParticipationSuperIntro')).toContain('PadCoins');
 expect(i18n.t('admin.padcoins.sedeParticipationSuperIntro')).not.toContain('Padbol Benefits');
});
