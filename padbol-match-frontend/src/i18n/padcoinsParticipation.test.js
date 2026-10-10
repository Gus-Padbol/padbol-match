import i18n from './index';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

test.each(PADBOL_LANGUAGE_CODES)('actual initialized %s resources render the participation count and unified brand', language => {
 const options={lng:language};
 const counter=i18n.t('admin.padcoins.sedeParticipationListCount',{...options,count:4});
 expect(counter).toContain('4');expect(counter).not.toMatch(/\{\{/);
 for (const key of ['sedeParticipationSuperIntro','sedeParticipationSuperToggle','sedeParticipationClubToggleHelp']) {
  const text=i18n.t(`admin.padcoins.${key}`,options);
  expect(text).toContain('PadCoins');expect(text).not.toContain('Padbol Benefits');
 }
});
