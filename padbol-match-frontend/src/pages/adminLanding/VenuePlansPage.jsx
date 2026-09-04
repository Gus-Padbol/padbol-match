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
            <p>Las comisiones de los planes corresponden al servicio prestado a la sede. Los costos de Mercado Pago, Stripe u otro procesador son independientes.</p>
          </div>
        </section>

        <section className="venue-plans__padbol-owner" aria-labelledby="padbol-owner-title">
          <div className="public-site__shell venue-plans__padbol-owner-grid">
            <div>
              <p className="venue-plans__eyebrow">BENEFICIO EXCLUSIVO PARA SEDES PADBOL</p>
              <h2 id="padbol-owner-title">¿Sos propietario de una o más canchas de Padbol?</h2>
              <p>Solicitá Padbol Match Pro sin cargo durante 12 meses y administrá tu sede desde una sola plataforma.</p>
              <small>Contanos sobre tu sede. Nuestro equipo te contactará para evaluar la solicitud y los próximos pasos.</small>
            </div>
            <Link
              className="venue-plans__cta venue-plans__cta--primary"
              to="/unirse?plan=pro&promo=padbol-pro-12m"
            >
              SOLICITAR 12 MESES PRO
            </Link>
          </div>
        </section>

        <section id="planes" className="venue-plans__section venue-plans__catalog" aria-labelledby="planes-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">PLANES PARA CRECER A TU RITMO</p>
            <h2 id="planes-title">Empezá administrando.<br /><span>Pasá a Pro para automatizar.</span></h2>
            <div className="venue-plans__grid">
              {plans.map((plan) => <PlanCard key={plan.slug} plan={plan} />)}
            </div>
            <p className="venue-plans__fine-print">Los límites, precios, promociones y comisiones dependen de la región y de la configuración vigente. Business se define por contacto comercial y validación técnica.</p>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__scoreboard" aria-labelledby="scoreboard-title">
          <div className="public-site__shell venue-plans__split">
            <div>
              <p className="venue-plans__eyebrow">TU MARCADOR DIGITAL, INCLUIDO DESDE STARTER</p>
              <h2 id="scoreboard-title">El partido en vivo.<br /><span>Sin equipamiento específico.</span></h2>
              <p>Teléfono · Tablet · Computadora · TV</p>
              <ul>
                <li>Score y actualización en vivo.</li>
                <li>Visualización en pantalla o TV.</li>
                <li>Uso inalámbrico desde los dispositivos del club.</li>
              </ul>
              <p className="venue-plans__note">Pro suma sponsors propios, torneos automatizados, reportes exportables, campañas PadCoins y notificaciones segmentadas.</p>
            </div>
            <figure>
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster="/media/public-site/jero/marcador-inteligente-captura.jpg"
                aria-label="Marcador digital de Padbol Match durante un partido"
              >
                <source src="/media/public-site/jero/marcador-inteligente.mp4" type="video/mp4" />
              </video>
              <figcaption>Marcador actualmente disponible en Padbol Match.</figcaption>
            </figure>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__multisport" aria-labelledby="multisport-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">UN CLUB. CUATRO DEPORTES.</p>
            <h2 id="multisport-title">Padbol · Pádel · Pickleball · Tenis</h2>
            <p>Administrá todas tus canchas desde una misma plataforma, aunque tu club practique diferentes deportes.</p>
            <div className="venue-plans__sport-grid" aria-hidden="true">
              <span>PADBOL</span><span>PÁDEL</span><span>PICKLEBALL</span><span>TENIS</span>
            </div>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__automation" aria-labelledby="automation-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">STARTER ADMINISTRA. PRO AUTOMATIZA.</p>
            <h2 id="automation-title">Más movimiento para tu club.<br /><span>Menos tareas repetidas.</span></h2>
            <div className="venue-plans__feature-grid">
              <FeaturePanel eyebrow="01" title="Torneos automáticos">Sorteo → zonas → partidos → resultados → clasificación → cruces → finales.</FeaturePanel>
              <FeaturePanel eyebrow="02" title="Generá nuevos ingresos">Membresías, promociones y espacios propios para sponsors.</FeaturePanel>
              <FeaturePanel eyebrow="03" title="Fidelizá jugadores">PadCoins, campañas y beneficios configurados por el club.</FeaturePanel>
              <FeaturePanel eyebrow="04" title="Reducí el costo de plataforma">Starter: 1% · Pro: 0,65%. Valores administrables por región.</FeaturePanel>
            </div>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__migration" aria-labelledby="migration-title">
          <div className="public-site__shell venue-plans__split">
            <div>
              <p className="venue-plans__eyebrow">¿YA USÁS OTRO SISTEMA?</p>
              <h2 id="migration-title">No empezás de cero.</h2>
              <p>Podemos importar información que pertenezca legítimamente a la sede y que tenga un formato compatible. El alcance se valida antes de comenzar.</p>
            </div>
            <ol className="venue-plans__migration-list">
              <li><b>Starter</b><span>Importación de archivos compatibles, sujeta a validación.</span></li>
              <li><b>Pro</b><span>Migración asistida.</span></li>
              <li><b>Business</b><span>Migración personalizada.</span></li>
            </ol>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__growth" aria-label="Herramientas de crecimiento Pro">
          <div className="public-site__shell venue-plans__feature-grid venue-plans__feature-grid--two">
            <FeaturePanel eyebrow="PRO" title="CREÁ TU PROPIA MEMBRESÍA">Definí precio, duración, beneficios, descuentos, horarios, prioridad, reservas incluidas y PadCoins. Es una membresía propia del club, separada de cualquier futura membresía global del jugador.</FeaturePanel>
            <FeaturePanel eyebrow="PRO" title="CONVERTÍ TUS PANTALLAS EN UN ACTIVO">Gestioná sponsors propios en marcador, TV, torneos y espacios locales disponibles. El inventario de la sede se mantiene separado del inventario Global Padbol Match y del de FIPA.</FeaturePanel>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__experiences" aria-labelledby="experiences-title">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">CINCO EXPERIENCIAS. UN SOLO PRODUCTO.</p>
            <h2 id="experiences-title">Signature · Stadium · Express · Arena · Quantum</h2>
            <p>Son interfaces visuales de Padbol Match. No son planes comerciales y no determinan si un club usa Starter, Pro o Business.</p>
          </div>
        </section>

        <section className="venue-plans__section venue-plans__final-cta">
          <div className="public-site__shell">
            <p className="venue-plans__eyebrow">PADBOL MATCH PARA CLUBES</p>
            <h2>Empezá sin costo fijo.<br /><span>La operación sigue siendo tuya.</span></h2>
            <div className="venue-plans__hero-actions">
              <Link to="/unirse?plan=starter" className="venue-plans__cta venue-plans__cta--primary">EMPEZAR SIN ABONO</Link>
              <Link to="/contacto?tema=business" className="venue-plans__cta venue-plans__cta--secondary">HABLEMOS</Link>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteLayout>
  );
}
