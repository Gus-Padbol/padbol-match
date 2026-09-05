import React from 'react';
import { Link } from 'react-router-dom';
import LegalStaticPageLayout, {
  LegalSectionTitle,
  LegalP,
  LegalUl,
  LegalLi,
  LegalA,
} from '../components/LegalStaticPageLayout';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const CONTACT = 'mailto:padbolinternacional@gmail.com';

export default function PoliticaPrivacidad() {
  const { t } = useTranslation();
  return (
    <LegalStaticPageLayout
      title={t('legal.privacyPage.title')}
      lead={t('legal.privacyPage.lead')}
    >
      <LegalSectionTitle>{t('legal.privacyPage.dataTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.privacyPage.dataIntro')}</LegalP>
      <LegalUl>
        <LegalLi>{t('legal.privacyPage.dataName')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.dataEmail')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.dataPhone')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.dataProfile')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.dataPhoto')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.dataActivity')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.dataTechnical')}</LegalLi>
      </LegalUl>

      <LegalSectionTitle>{t('legal.privacyPage.useTitle')}</LegalSectionTitle>
      <LegalUl>
        <LegalLi>{t('legal.privacyPage.useBookings')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.useTournaments')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.useNotifications')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.useCommunity')}</LegalLi>
        <LegalLi>{t('legal.privacyPage.useSecurity')}</LegalLi>
      </LegalUl>

      <LegalSectionTitle>{t('legal.privacyPage.noSaleTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.privacyPage.noSaleBody')}</LegalP>

      <LegalSectionTitle>{t('legal.privacyPage.paymentsTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.privacyPage.paymentsBody')}</LegalP>
      <LegalUl>
        <LegalLi>
          Mercado Pago: <LegalA href="https://www.mercadopago.com.ar/privacidad">{t('legal.privacyPage.privacyPolicyLink')}</LegalA>
        </LegalLi>
        <LegalLi>
          Stripe: <LegalA href="https://stripe.com/privacy">{t('legal.privacyPage.privacyCenterLink')}</LegalA>
        </LegalLi>
      </LegalUl>

      <LegalSectionTitle>{t('legal.privacyPage.deletionTitle')}</LegalSectionTitle>
      <LegalP>
        {t('legal.privacyPage.deletionPrefix')}{' '}
        <Link to="/eliminar-cuenta" style={{ color: '#a5b4fc', fontWeight: 700 }}>
          {t('accountDeletion.title')}
        </Link>
        {t('legal.privacyPage.deletionMiddle')}{' '}
        <a href={CONTACT} style={{ color: '#a5b4fc', fontWeight: 700 }}>padbolinternacional@gmail.com</a>{t('legal.privacyPage.deletionSuffix')}
      </LegalP>

      <LegalSectionTitle>{t('legal.privacyPage.cookiesTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.privacyPage.cookiesBody')}</LegalP>

      <LegalSectionTitle>{t('legal.privacyPage.gdprTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.privacyPage.gdprBody')}</LegalP>

      <LegalSectionTitle>{t('legal.privacyPage.contactTitle')}</LegalSectionTitle>
      <LegalP>
        {t('legal.privacyPage.contactBody')}{' '}
        <a href={CONTACT} style={{ color: '#a5b4fc', fontWeight: 700 }}>
          padbolinternacional@gmail.com
        </a>
        .
      </LegalP>
    </LegalStaticPageLayout>
  );
}
