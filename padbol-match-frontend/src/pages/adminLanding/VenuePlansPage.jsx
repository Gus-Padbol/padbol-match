import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicSiteLayout from '../publicSite/PublicSiteLayout';
import '../publicSite/publicSite.css';
import './adminVenueLanding.css';
import './venuePlansPage.css';

const plans = [
  {
    name: 'Gratis',
    monthly: 'US$ 0',
    annual: 'US$ 0',
    summary: 'Para conocer Padbol Match y evaluar la propuesta con tu equipo.',
    includes: ['Recorrido guiado de la propuesta', 'Configuración inicial acompañada', 'Asistente Chivi por voz o texto', 'Soporte humano por tickets'],
  },
  {
    name: 'Start',
    monthly: 'US$ 29',
    annual: 'US$ 290',
    summary: 'Para ordenar la operación diaria de una sede en un solo lugar.',
    includes: ['Canchas, horarios y precios', 'Reservas y gestión de jugadores', 'Configuración de señas y cancelaciones', 'Panel de administración de la sede'],
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

const WHATSAPP_NUMBER = '17864588533';

function consultationUrl(planName) {
  const message = `Hola, quiero consultar el plan ${planName} para mi sede en Padbol Match.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

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
            <p className="venue-plans__lead">Todo lo que incluye cada opción, en una sola pantalla. Elegí una modalidad para comparar los valores.</p>
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
                  {isAnnual && plan.name !== 'Gratis' && <p className="venue-plans__saving">Equivale a 10 meses</p>}
                  <p className="venue-plans__summary">{plan.summary}</p>
                  <div className="venue-plans__includes">
                    <h3>Incluye</h3>
                    <ul>
                      {plan.includes.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <a
                    className="venue-plans__action"
                    href={consultationUrl(plan.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Consultar este plan <span>→</span>
                  </a>
                </article>
              ))}
            </div>
            <p className="venue-plans__note">Los valores son referenciales. La contratación, la modalidad de cobro y la activación se confirman con el equipo antes de avanzar.</p>
          </div>
        </section>
      </main>
    </PublicSiteLayout>
  );
}
