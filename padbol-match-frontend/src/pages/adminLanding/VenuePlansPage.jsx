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

function formatAmount(value, currency = 'USD') {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${currency} ${new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
  }).format(number)}`;
}

function formatCommission(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'A definir';
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(number)}%`;
}

function useDocumentMeta() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || '';
    document.title = 'Padbol Match para clubes — Planes';
    description?.setAttribute(
      'content',
      'Padbol Match reúne reservas, jugadores, partidos, torneos, rankings, marcador digital y gestión de clubes multideporte.',
    );
    document.documentElement.classList.add('public-site-active', 'venue-plans-active');
    window.scrollTo(0, 0);

    return () => {
      document.title = previousTitle;
      description?.setAttribute('content', previousDescription);
      document.documentElement.classList.remove('public-site-active', 'venue-plans-active');
    };
  }, []);
}

function PlanCard({ plan }) {
  const monthly = formatAmount(plan.monthlyAmount, plan.currency);
  const annual = formatAmount(plan.annualAmount, plan.currency);
  const prefix = plan.pricePrefix ? `${plan.pricePrefix} ` : '';
  const commissionPrefix = plan.commissionPrefix ? `${plan.commissionPrefix} ` : '';

  return (
    <article className={`venue-plans__card${plan.featured ? ' venue-plans__card--featured' : ''}`}>
      {plan.featured ? <p className="venue-plans__badge">MÁS ELEGIDO</p> : null}
      <header>
        <h3>{plan.name}</h3>
        <p className="venue-plans__summary">{plan.summary}</p>
      </header>
      <div className="venue-plans__price-block">
        <p className="venue-plans__price">
          <span>{prefix}</span>{monthly}<small>/ mes</small>
        </p>
        {annual != null && Number(plan.annualAmount) !== Number(plan.monthlyAmount) ? (
          <p className="venue-plans__annual">o {annual} / año</p>
        ) : null}
      </div>
      <div className="venue-plans__limits" aria-label={`Límites del plan ${plan.name}`}>
        <span>{plan.courtsLabel}</span>
        <span>{plan.adminsLabel}</span>
      </div>
      <ul className="venue-plans__features">
        {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
      <div className="venue-plans__commission">
        <span>Servicio a la sede</span>
        <strong>{commissionPrefix}{formatCommission(plan.commissionPercent)}</strong>
        <small>sobre operaciones procesadas mediante Padbol Match</small>
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
  const plans = catalogOverride || COMMERCIAL_PLANS_PREVIEW;
  useDocumentMeta();

  return (
    <PublicSiteLayout currentPage="plans">
      <main className="venue-plans">
        <section className="venue-plans__hero">
          <div className="public-site__shell venue-plans__hero-grid">
            <div className="venue-plans__hero-copy">
              {!COMMERCIAL_PRICING_PUBLIC ? <p className="venue-plans__draft">BORRADOR INTERNO · NO PUBLICADO</p> : null}
              <Link to="/administradores" className="venue-plans__back">← Para administradores</Link>
              <p className="venue-plans__eyebrow">PADBOL MATCH PARA CLUBES</p>
              <h1>Todo tu club.<br /><span>Una sola plataforma.</span></h1>
              <p className="venue-plans__sports">Padbol <i>·</i> Pádel <i>·</i> Pickleball <i>·</i> Tenis</p>
              <p className="venue-plans__lead">Reservas, jugadores, partidos, torneos, rankings, marcador en vivo, membresías y gestión desde un mismo lugar.</p>
              <div className="venue-plans__hero-actions">
                <Link to="/unirse?plan=starter" className="venue-plans__cta venue-plans__cta--primary">EMPEZAR SIN ABONO</Link>
                <a href="#planes" className="venue-plans__cta venue-plans__cta--secondary">VER PLANES</a>
              </div>
            </div>
            <div className="venue-plans__hero-visual" aria-label="Operación conectada del club">
              <span>CLUB EN VIVO</span>
              <strong>4 deportes</strong>
              <div className="venue-plans__pulse-row"><i /> Reservas y disponibilidad</div>
              <div className="venue-plans__pulse-row"><i /> Partido y marcador en vivo</div>
              <div className="venue-plans__pulse-row"><i /> Resultados, ranking y retorno</div>
              <p>Una operación conectada antes, durante y después de jugar.</p>
            </div>
          </div>
        </section>

        <section className="venue-plans__player-fee" aria-label="Comisiones al jugador">
          <div className="public-site__shell">
            <strong>EL JUGADOR PAGA 0% DE COMISIÓN A PADBOL MATCH.</strong>
            <p>Las comisiones de los planes corresponden al servicio prestado a la sede. Los costos de los procesadores de pago son independientes.</p>
          </div>
        </section>

        <section className="venue-plans__padbol-owner" aria-labelledby="padbol-owner-title">
          <div className="public-site__shell venue-plans__padbol-owner-grid">
            <div>
              <p className="venue-plans__eyebrow">BENEFICIO EXCLUSIVO PARA SEDES PADBOL</p>
              <h2 id="padbol-owner-title">¿Eres propietario de una o más canchas de Padbol?</h2>
              <p>Empieza con 6 meses de Padbol Match Pro sin cargo y renuévalo mes a mes usando la plataforma de forma continua.</p>
              <small>Los objetivos son claros, se verifican dentro de Padbol Match y no generan cargos automáticos ni ocultos.</small>
            </div>
            <Link
              className="venue-plans__cta venue-plans__cta--primary"
              to="/unirse?plan=pro&promo=padbol-pro-renovable"
            >
              EMPEZAR 6 MESES PRO SIN CARGO
            </Link>
          </div>
        </section>

        <section id="planes" className="venue-plans__section venue-plans__catalog" aria-labelledby="planes-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">PLANES PARA CRECER A TU RITMO</p>
            <h2 id="planes-title">Empieza administrando.<br /><span>Pasa a Pro para automatizar.</span></h2>
            <div className="venue-plans__grid">
              {plans.map((plan) => <PlanCard key={plan.slug} plan={plan} />)}
            </div>
            <p className="venue-plans__fine-print">Los límites, precios, promociones y comisiones dependen de la región y de la configuración vigente. Business se define por contacto comercial y validación técnica.</p>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__automation" aria-labelledby="automation-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">LO QUE GANA TU CLUB</p>
            <h2 id="automation-title">Más movimiento.<br /><span>Una operación más simple.</span></h2>
            <div className="venue-plans__feature-grid">
              <FeaturePanel eyebrow="01" title="Menos tareas repetidas">Pro automatiza sorteos, zonas, partidos, resultados, clasificación, cruces y finales.</FeaturePanel>
              <FeaturePanel eyebrow="02" title="Nuevos ingresos">Creá membresías, promociones y espacios propios para sponsors dentro de la operación del club.</FeaturePanel>
              <FeaturePanel eyebrow="03" title="Jugadores que vuelven">Activá PadCoins, campañas y beneficios configurados por tu sede.</FeaturePanel>
              <FeaturePanel eyebrow="04" title="Marcador incluido">Llevá el partido en vivo desde teléfono, tablet o computadora y mostralo en una TV, sin equipamiento específico.</FeaturePanel>
            </div>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__migration" aria-labelledby="migration-title">
          <div className="public-site__shell venue-plans__split">
            <div>
              <p className="venue-plans__eyebrow">¿YA USÁS OTRO SISTEMA?</p>
              <h2 id="migration-title">No empiezas de cero.</h2>
              <p>Podemos importar información que pertenezca legítimamente a la sede y que tenga un formato compatible. El alcance se valida antes de comenzar.</p>
            </div>
            <ol className="venue-plans__migration-list">
              <li><b>Starter</b><span>Importación de archivos compatibles, sujeta a validación.</span></li>
              <li><b>Pro</b><span>Migración asistida.</span></li>
              <li><b>Business</b><span>Migración personalizada.</span></li>
            </ol>
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
            <p className="venue-plans__eyebrow">PADBOL MATCH PARA CLUBES</p>
            <h2>Empieza sin costo fijo.<br /><span>La operación sigue siendo tuya.</span></h2>
            <div className="venue-plans__hero-actions">
              <Link to="/unirse?plan=starter" className="venue-plans__cta venue-plans__cta--primary">EMPEZAR SIN ABONO</Link>
              <Link to="/contacto?tema=business" className="venue-plans__cta venue-plans__cta--secondary">CONSULTAR PLAN BUSINESS</Link>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteLayout>
  );
}
