import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicSiteLayout from '../publicSite/PublicSiteLayout';
import {
  COMMERCIAL_PLANS_PREVIEW,
  COMMERCIAL_PRICING_PUBLIC,
} from '../../config/commercialPlans';
import '../publicSite/publicSite.css';
import './adminVenueLanding.css';
import './venuePlansPage.css';
import { useSafeTranslation } from '../../i18n/tSafe';
import { padbolLangToIntlLocale } from '../../utils/padbolLang';
import { venuePlansCopy } from './venuePlansCopy';

function formatAmount(value, currency = 'USD', locale = 'en-US') {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${currency} ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
  }).format(number)}`;
}

function formatCommission(value, locale = 'en-US', notDefined = 'To be defined') {
  const number = Number(value);
  if (!Number.isFinite(number)) return notDefined;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(number)}%`;
}

function useDocumentMeta(title, metaDescription) {
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || '';
    document.title = title;
    description?.setAttribute('content', metaDescription);
    document.documentElement.classList.add('public-site-active', 'venue-plans-active');
    window.scrollTo(0, 0);

    return () => {
      document.title = previousTitle;
      description?.setAttribute('content', previousDescription);
      document.documentElement.classList.remove('public-site-active', 'venue-plans-active');
    };
  }, [metaDescription, title]);
}

function PlanCard({ plan, copy, locale }) {
  const monthly = formatAmount(plan.monthlyAmount, plan.currency, locale);
  const annual = formatAmount(plan.annualAmount, plan.currency, locale);
  const prefix = plan.pricePrefix ? `${plan.pricePrefix} ` : '';
  const commissionPrefix = plan.commissionPrefix ? `${plan.commissionPrefix} ` : '';

  return (
    <article className={`venue-plans__card${plan.featured ? ' venue-plans__card--featured' : ''}`}>
      {plan.featured ? <p className="venue-plans__badge">{copy.featured}</p> : null}
      <header>
        <h3>{plan.name}</h3>
        <p className="venue-plans__summary">{plan.summary}</p>
      </header>
      <div className="venue-plans__price-block">
        <p className="venue-plans__price">
          <span>{prefix}</span>{monthly}<small>{copy.perMonth}</small>
        </p>
        {annual != null && Number(plan.annualAmount) !== Number(plan.monthlyAmount) ? (
          <p className="venue-plans__annual">{copy.or} {annual} {copy.perYear}</p>
        ) : null}
      </div>
      <div className="venue-plans__limits" aria-label={`${copy.limits} ${plan.name}`}>
        <span>{plan.courtsLabel}</span>
        <span>{plan.adminsLabel}</span>
      </div>
      <ul className="venue-plans__features">
        {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
      <div className="venue-plans__commission">
        <span>{copy.venueService}</span>
        <strong>{commissionPrefix}{formatCommission(plan.commissionPercent, locale, copy.notDefined)}</strong>
        <small>{copy.commissionNote}</small>
      </div>
      <Link className="venue-plans__plan-cta" to={plan.ctaPath}>{plan.ctaLabel}</Link>
    </article>
  );
}

function FeaturePanel({ eyebrow, title, children }) {
  return (
    <article className="venue-plans__feature-panel">
      <p>{eyebrow}</p>
      <h3>{title}</h3>
      <div>{children}</div>
    </article>
  );
}

const PLAN_FAQS = [
  {
    question: '¿Hay cargos ocultos?',
    answer: 'No. Antes de activar un plan, la sede conoce y acepta el abono y la comisión correspondientes. Los costos del procesador de pago son independientes y no los cobra Padbol Match.',
  },
  {
    question: '¿Me cobran por enviar una solicitud?',
    answer: 'No. Enviar el formulario solamente inicia el contacto. No activa ningún cobro ni suscripción.',
  },
  {
    question: '¿El jugador paga comisión?',
    answer: 'No. El jugador paga 0% de comisión a Padbol Match.',
  },
  {
    question: '¿Necesito equipamiento especial para el marcador?',
    answer: 'No. El marcador puede utilizarse desde un teléfono, una tablet o una computadora y visualizarse en una TV.',
  },
  {
    question: '¿Puedo traer información de otro sistema?',
    answer: 'Sí, cuando el formato sea compatible. El alcance de la migración se revisa con la sede antes de comenzar.',
  },
  {
    question: '¿Qué pasa si tengo varias sedes?',
    answer: 'Business está pensado para cadenas y operadores multisede. La administración central, los permisos de cada sede, los reportes consolidados y el precio por volumen se definen con cada organización antes de activar el servicio.',
  },
];

export default function VenuePlansPage({ catalogOverride = null }) {
  const { i18n } = useSafeTranslation();
  const copy = venuePlansCopy(i18n.resolvedLanguage || i18n.language);
  const locale = padbolLangToIntlLocale(i18n.resolvedLanguage || i18n.language);
  const sourcePlans = catalogOverride || COMMERCIAL_PLANS_PREVIEW;
  const plans = sourcePlans.map((plan) => ({ ...plan, ...(copy.plans[plan.slug] || {}) }));
  useDocumentMeta(copy.metaTitle, copy.metaDescription);

  return (
    <PublicSiteLayout currentPage="plans">
      <main className="venue-plans">
        <section className="venue-plans__hero">
          <div className="public-site__shell venue-plans__hero-grid">
            <div className="venue-plans__hero-copy">
              {!COMMERCIAL_PRICING_PUBLIC ? <p className="venue-plans__draft">{copy.draft}</p> : null}
              <Link to="/administradores" className="venue-plans__back">{copy.back}</Link>
              <p className="venue-plans__eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}<br /><span>{copy.titleAccent}</span></h1>
              <p className="venue-plans__sports">{copy.sports}</p>
              <p className="venue-plans__lead">{copy.lead}</p>
              <div className="venue-plans__hero-actions">
                <Link to="/unirse?plan=starter" className="venue-plans__cta venue-plans__cta--primary">{copy.start}</Link>
                <a href="#planes" className="venue-plans__cta venue-plans__cta--secondary">{copy.seePlans}</a>
              </div>
            </div>
            <div className="venue-plans__hero-visual" aria-label={copy.operationAria}>
              <span>{copy.liveClub}</span>
              <strong>{copy.fourSports}</strong>
              <div className="venue-plans__pulse-row"><i /> {copy.bookings}</div>
              <div className="venue-plans__pulse-row"><i /> {copy.liveMatch}</div>
              <div className="venue-plans__pulse-row"><i /> {copy.results}</div>
              <p>{copy.connected}</p>
            </div>
          </div>
        </section>

        <section className="venue-plans__player-fee" aria-label={copy.playerFeeAria}>
          <div className="public-site__shell">
            <strong>{copy.playerFeeTitle}</strong>
            <p>{copy.playerFeeText}</p>
          </div>
        </section>

        <section className="venue-plans__padbol-owner" aria-labelledby="padbol-owner-title">
          <div className="public-site__shell venue-plans__padbol-owner-grid">
            <div>
              <p className="venue-plans__eyebrow">{copy.padbolBenefit}</p>
              <h2 id="padbol-owner-title">{copy.padbolOwnerTitle}</h2>
              <p>{copy.padbolOwnerText}</p>
              <small>{copy.padbolOwnerHint}</small>
            </div>
            <Link
              className="venue-plans__cta venue-plans__cta--primary"
              to="/unirse?plan=pro&promo=padbol-pro-renovable"
            >
              {copy.padbolOwnerCta}
            </Link>
          </div>
        </section>

        <section id="planes" className="venue-plans__section venue-plans__catalog" aria-labelledby="planes-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">{copy.plansEyebrow}</p>
            <h2 id="planes-title">{copy.plansTitle}<br /><span>{copy.plansAccent}</span></h2>
            <div className="venue-plans__grid">
              {plans.map((plan) => <PlanCard key={plan.slug} plan={plan} copy={copy} locale={locale} />)}
            </div>
            <p className="venue-plans__fine-print">{copy.finePrint}</p>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__scoreboard" aria-labelledby="scoreboard-title">
          <div className="public-site__shell venue-plans__split">
            <div>
              <p className="venue-plans__eyebrow">{copy.scoreboardEyebrow}</p>
              <h2 id="scoreboard-title">{copy.scoreboardTitle}<br /><span>{copy.scoreboardAccent}</span></h2>
              <p>{copy.devices}</p>
              <ul>
                {copy.scoreboardItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="venue-plans__note">{copy.scoreboardNote}</p>
            </div>
            <figure>
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster="/media/public-site/jero/marcador-inteligente-captura.jpg"
                aria-label={copy.scoreboardAria}
              >
                <source src="/media/public-site/jero/marcador-inteligente.mp4" type="video/mp4" />
              </video>
              <figcaption>{copy.scoreboardCaption}</figcaption>
            </figure>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__multisport" aria-labelledby="multisport-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">{copy.multisportEyebrow}</p>
            <h2 id="multisport-title">{copy.multisportTitle}</h2>
            <p>{copy.multisportText}</p>
            <div className="venue-plans__sport-grid" aria-hidden="true">
              {copy.multisportTitle.split(' · ').map((sport) => <span key={sport}>{sport.toUpperCase()}</span>)}
            </div>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__automation" aria-labelledby="automation-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">{copy.automationEyebrow}</p>
            <h2 id="automation-title">{copy.automationTitle}<br /><span>{copy.automationAccent}</span></h2>
            <div className="venue-plans__feature-grid">
              {copy.automation.map(([title, body], index) => (
                <FeaturePanel key={title} eyebrow={String(index + 1).padStart(2, '0')} title={title}>{body}</FeaturePanel>
              ))}
            </div>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__migration" aria-labelledby="migration-title">
          <div className="public-site__shell venue-plans__split">
            <div>
              <p className="venue-plans__eyebrow">{copy.migrationEyebrow}</p>
              <h2 id="migration-title">{copy.migrationTitle}</h2>
              <p>{copy.migrationText}</p>
            </div>
            <ol className="venue-plans__migration-list">
              {copy.migration.map(([name, body]) => <li key={name}><b>{name}</b><span>{body}</span></li>)}
            </ol>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__growth" aria-label={copy.growthAria}>
          <div className="public-site__shell venue-plans__feature-grid venue-plans__feature-grid--two">
            <FeaturePanel eyebrow="PRO" title={copy.membershipTitle}>{copy.membershipText}</FeaturePanel>
            <FeaturePanel eyebrow="PRO" title={copy.screensTitle}>{copy.screensText}</FeaturePanel>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__experiences" aria-labelledby="experiences-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">{copy.experiencesEyebrow}</p>
            <h2 id="experiences-title">Signature · Stadium · Express · Arena · Quantum</h2>
            <p>{copy.experiencesText}</p>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__faq" aria-labelledby="plans-faq-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">PREGUNTAS CLARAS. RESPUESTAS DIRECTAS.</p>
            <h2 id="plans-faq-title">Sin sorpresas.<br /><span>Sin cargos ocultos.</span></h2>
            <div className="venue-plans__faq-list">
              {PLAN_FAQS.map((item) => (
                <details key={item.question} className="venue-plans__faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
            <div className="venue-plans__chivi-help">
              <div>
                <strong>¿Te quedó alguna duda?</strong>
                <span>Chivi puede explicarte los planes y ayudarte a encontrar la opción adecuada para tu sede.</span>
              </div>
              <button
                type="button"
                className="venue-plans__cta venue-plans__cta--primary"
                onClick={() => window.dispatchEvent(new Event('padbol:open-chivi'))}
              >
                PREGUNTALE A CHIVI
              </button>
            </div>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__final-cta">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">{copy.eyebrow}</p>
            <h2>{copy.finalTitle}<br /><span>{copy.finalAccent}</span></h2>
            <div className="venue-plans__hero-actions">
              <Link to="/unirse?plan=starter" className="venue-plans__cta venue-plans__cta--primary">{copy.start}</Link>
              <Link to="/contacto?tema=business" className="venue-plans__cta venue-plans__cta--secondary">{copy.talk}</Link>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteLayout>
  );
}
