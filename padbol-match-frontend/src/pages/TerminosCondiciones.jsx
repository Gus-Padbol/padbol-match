import React from 'react';
import LegalStaticPageLayout, {
  LegalSectionTitle,
  LegalP,
  LegalUl,
  LegalLi,
} from '../components/LegalStaticPageLayout';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { LEGAL_DOCUMENTS } from '../utils/legalDocuments';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_HREF,
  LEGAL_ENTITY,
  LEGAL_REGISTERED_ADDRESS,
} from '../constants/legalIdentity';

export default function TerminosCondiciones() {
  const { t } = useTranslation();
  return (
    <LegalStaticPageLayout
      title={t('legal.termsPage.title')}
      lead={t('legal.termsPage.lead')}
      version={LEGAL_DOCUMENTS.terms.version}
    >
      <LegalSectionTitle>{t('legal.termsPage.ownerTitle')}</LegalSectionTitle>
      <LegalP>
        {t('legal.termsPage.ownerPrefix')}{' '}
        <strong style={{ color: '#e2e8f0' }}>{LEGAL_ENTITY}</strong>.
        <br />
        {LEGAL_REGISTERED_ADDRESS}.
      </LegalP>

      <LegalSectionTitle>{t('legal.termsPage.whatTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.termsPage.whatBody')}</LegalP>

      <LegalSectionTitle>{t('legal.termsPage.useTitle')}</LegalSectionTitle>
      <LegalUl>
        <LegalLi>{t('legal.termsPage.useTruth')}</LegalLi>
        <LegalLi>{t('legal.termsPage.useProhibited')}</LegalLi>
        <LegalLi>{t('legal.termsPage.useSuspend')}</LegalLi>
      </LegalUl>

      <LegalSectionTitle>{t('legal.termsPage.bookingTitle')}</LegalSectionTitle>
      <LegalUl>
        <LegalLi>{t('legal.termsPage.bookingPayment')}</LegalLi>
        <LegalLi>{t('legal.termsPage.bookingCancellation')}</LegalLi>
        <LegalLi>{t('legal.termsPage.bookingFee')}</LegalLi>
      </LegalUl>

      <LegalSectionTitle>{t('legal.termsPage.tournamentsTitle')}</LegalSectionTitle>
      <LegalUl>
        <LegalLi>{t('legal.termsPage.tournamentApproval')}</LegalLi>
        <LegalLi>{t('legal.termsPage.tournamentCategories')}</LegalLi>
      </LegalUl>

      <LegalSectionTitle>{t('legal.termsPage.reportsTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.termsPage.reportsBody')}</LegalP>
      <LegalP>{t('legal.termsPage.reportsResponsibility')}</LegalP>

      <LegalSectionTitle>{t('legal.termsPage.liabilityTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.termsPage.liabilityBody')}</LegalP>

      <LegalSectionTitle>{t('legal.termsPage.ipTitle')}</LegalSectionTitle>
      <LegalP>
        {t('legal.termsPage.ipPrefix')} <strong style={{ color: '#e2e8f0' }}>PADBOL®</strong> {t('legal.termsPage.ipMiddle')} <strong style={{ color: '#e2e8f0' }}>FIPA</strong>{t('legal.termsPage.ipSuffix')}
      </LegalP>

      <LegalSectionTitle>{t('legal.termsPage.lawTitle')}</LegalSectionTitle>
      <LegalP>{t('legal.termsPage.lawBody')}</LegalP>

      <LegalSectionTitle>{t('legal.termsPage.contactTitle')}</LegalSectionTitle>
      <LegalP>
        {t('legal.termsPage.contactBody')}{' '}
        <a href={LEGAL_CONTACT_HREF} style={{ color: '#a5b4fc', fontWeight: 700 }}>
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </LegalP>
    </LegalStaticPageLayout>
  );
}
