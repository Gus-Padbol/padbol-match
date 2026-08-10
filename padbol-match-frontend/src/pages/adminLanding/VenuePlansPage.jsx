import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicSiteLayout from '../publicSite/PublicSiteLayout';
import '../publicSite/publicSite.css';
import './adminVenueLanding.css';
import './venuePlansPage.css';

const plans = [
  {
    name: 'Start',
    monthly: 'US$ 29',
    annual: 'US$ 290',
    summary: 'El punto de partida para poner en marcha y ordenar la operación diaria de tu sede.',
    includes: ['Configuración guiada de la sede', 'Canchas, horarios y precios', 'Reservas y gestión de jugadores', 'Panel de administración de la sede'],
  },
  {
    name: 'Club',
    monthly: 'US$ 59',
    annual: 'US$ 590',
    summary: 'Para sumar competencia, comunidad y herramientas de fidelización.',
    includes: ['Todo lo incluido en Start', 'Torneos, fixture y resultados', 'Marcador, tablas y ranking', 'PadCoins, beneficios y membresías'],
  },
  {
    name: 'Pro',
    monthly: 'US$ 99',
    annual: 'US$ 990',
    summary: 'Para una operación más completa, con activación y crecimiento por etapas.',
    includes: ['Todo lo incluido en Club', 'Campañas y propuestas activas', 'Herramientas para comunidad y sponsors', 'Acompañamiento para crecimiento de la sede'],
  },
];

function useDocumentMeta() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Planes para sedes | Padbol Match';
    document.documentElement.classList.add('public-site-active', 'venue-plans-active');
    window.scrollTo(0, 0);

    return () => {
      document.title = previousTitle;
      document.documentElement.classList.remove('public-site-active', 'venue-plans-active');
    };
  }, []);
}

export default function VenuePlansPage() {
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  useDocumentMeta();

  const isAnnual = billingPeriod === 'annual';

  return (
    <PublicSiteLayout>
      <main className="venue-plans">
        <section className="venue-plans__hero">
          <div className="admin-landing__shell">
            <Link to="/administradores" className="venue-plans__back">← Volver a administradores</Link>
            <p className="admin-landing__eyebrow">PLANES PARA SEDES</p>
            <h1>Elegí el plan que acompaña a tu <span>sede.</span></h1>
            <p className="venue-plans__lead">Todo lo que incluye cada opción, en una sola pantalla. Elegí una modalidad para comparar los valores; la contratación online se habilitará acá mismo.</p>
            <div className="venue-plans__billing" role="group" aria-label="Modalidad de pago">
              <button type="button" className={!isAnnual ? 'is-active' : ''} onClick={() => setBillingPeriod('monthly')} aria-pressed={!isAnnual}>Mensual</button>
              <button type="button" className={isAnnual ? 'is-active' : ''} onClick={() => setBillingPeriod('annual')} aria-pressed={isAnnual}>Anual <span>2 meses bonificados</span></button>
            </div>
          </div>
        </section>

        <section className="venue-plans__catalog" aria-labelledby="planes-title">
          <div className="admin-landing__shell">
            <h2 id="planes-title" className="venue-plans__visually-hidden">Opciones de planes para sedes</h2>
            <div className="venue-plans__grid">
              {plans.map((plan) => (
                <article className={`venue-plans__card ${plan.name === 'Pro' ? 'venue-plans__card--pro' : ''}`} key={plan.name}>
                  {plan.name === 'Pro' && <p className="venue-plans__badge">MÁS COMPLETO</p>}
                  <h2>{plan.name}</h2>
                  <p className="venue-plans__price">
                    {isAnnual ? plan.annual : plan.monthly}
                    <span>{isAnnual ? '/ año' : '/ mes'}</span>
                  </p>
                  {isAnnual && <p className="venue-plans__saving">Equivale a 10 meses</p>}
                  <p className="venue-plans__summary">{plan.summary}</p>
                  <div className="venue-plans__includes">
                    <h3>Incluye</h3>
                    <ul>
                      {plan.includes.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
            <p className="venue-plans__note">Valores expresados en USD. El precio final y los impuestos aplicables se mostrarán antes de confirmar el pago.</p>
          </div>
        </section>
      </main>
    </PublicSiteLayout>
  );
}
