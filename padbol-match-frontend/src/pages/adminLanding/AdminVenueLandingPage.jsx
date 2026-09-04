import React, { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicSiteLayout from '../publicSite/PublicSiteLayout';
import dataOwnershipVisual from '../../assets/data-ownership-visual.png';
import { useSafeTranslation } from '../../i18n/tSafe';
import '../publicSite/publicSite.css';
import './adminVenueLanding.css';
import './adminVenueLandingOverrides.css';

function useDocumentMeta(title) {
  useLayoutEffect(() => {
    const previousTitle = document.title;
    const previousScrollRestoration = window.history.scrollRestoration;
    document.title = title;
    // La landing de sedes es una sección de la web pública: comparte el mismo
    // documento, header, ancho y comportamiento responsive que /plataforma.
    document.documentElement.classList.add('public-site-active', 'admin-landing-active');
    // No reutilizar el desplazamiento (incluido X) de otra pantalla pública al
    // volver a esta ruta. La landing siempre empieza desde su composición.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    // Esta ruta no tiene ningún contenido desplazable en X. Safari puede
    // conservar o recuperar una posición horizontal anterior al volver a la
    // página; la normalizamos de forma explícita para que nunca abra corrida.
    let frameId = null;
    const resetTimers = [];
    const resetHorizontalScroll = () => {
      if (window.scrollX === 0 && document.documentElement.scrollLeft === 0 && document.body.scrollLeft === 0) return;
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    };
    const handleScroll = () => {
      if (frameId != null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        resetHorizontalScroll();
      });
    };
    const scheduleHorizontalReset = () => {
      // Safari puede restaurar la posición al terminar de pintar, después del
      // primer frame de React. Repetimos el mismo ajuste brevemente solo al
      // entrar para que jamás quede fija una vista corrida.
      [0, 80, 260, 700].forEach((delay) => {
        resetTimers.push(window.setTimeout(resetHorizontalScroll, delay));
      });
    };

    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    scheduleHorizontalReset();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pageshow', scheduleHorizontalReset);
    window.visualViewport?.addEventListener('scroll', scheduleHorizontalReset, { passive: true });
    return () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
      resetTimers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pageshow', scheduleHorizontalReset);
      window.visualViewport?.removeEventListener('scroll', scheduleHorizontalReset);
      document.title = previousTitle;
      if ('scrollRestoration' in window.history) window.history.scrollRestoration = previousScrollRestoration;
      document.documentElement.classList.remove('public-site-active', 'admin-landing-active');
    };
  }, [title]);
}

export default function AdminVenueLandingPage() {
  const { t } = useSafeTranslation();
  const text = (key) => t(`adminLanding.${key}`);
  const modules = ['one', 'two', 'three', 'four', 'five', 'six'].map((key, index) => ({
    number: String(index + 1).padStart(2, '0'), title: text(`modules.${key}.title`), description: text(`modules.${key}.text`),
  }));
  useDocumentMeta(text('metaTitle'));
  return (
    <PublicSiteLayout>
    <div className="admin-landing">
      <main>
        <section className="admin-landing__hero" id="inicio">
          <div className="admin-landing__shell admin-landing__hero-grid">
            <div>
              <p className="admin-landing__eyebrow">{text('eyebrow')}</p>
              <h1>{text('title')}<span>{text('titleAccent')}</span></h1>
              <p className="admin-landing__lead">{text('lead')}</p>
              <div className="admin-landing__hero-actions">
                <Link to="/planes" className="admin-landing__primary">{text('primaryCta')} <span>→</span></Link>
              </div>
            </div>
            <div className="admin-landing__hero-panel admin-landing__pulse" aria-label={text('pulseAria')}>
              <header className="admin-landing__pulse-header"><p>{text('pulse')}</p><span><i aria-hidden="true" />LIVE</span></header>
              <div className="admin-landing__pulse-topline"><span>{text('today')}</span><b>•</b><span>{text('court')}</span><b>•</b><em><i aria-hidden="true" />{text('inPlay')}</em></div>
              <section className="admin-landing__pulse-match"><p>{text('liveMatch')}</p><div className="admin-landing__pulse-score"><div className="admin-landing__pulse-team admin-landing__pulse-team--serving"><strong>LUNA <span className="admin-landing__serve-status"><i aria-hidden="true" />{text('serves')}</span><br />ROJAS</strong></div><b>4 <i>−</i> 3</b><div className="admin-landing__pulse-team admin-landing__pulse-team--right"><strong>PÉREZ<br />DÍAZ</strong></div></div><span>{text('set')}&nbsp; · &nbsp;18:42</span></section>
              <ol className="admin-landing__pulse-outcomes"><li><i>✓</i><div><strong>{text('resultRegistered')}</strong><span>{text('resultRegisteredText')}</span></div></li><li><i>▮▮▮</i><div><strong>{text('rankingUpdated')}</strong><span>{text('rankingUpdatedText')}</span></div></li><li><i>P</i><div><strong>{text('padcoinsCredited')}</strong><span>{text('padcoinsCreditedText')}</span></div></li></ol>
              <div className="admin-landing__pulse-return"><span>◉</span><b>+32</b><p>{text('playersReturn').split('\n').map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{index ? <em>{line}</em> : line}</React.Fragment>)}</p></div>
            </div>
          </div>
        </section>

        <section className="admin-landing__reports" aria-labelledby="reportes-title">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">{text('reportsEyebrow')}</p>
            <div className="admin-landing__reports-heading">
              <h2 id="reportes-title">{text('reportsTitle')}<span>{text('reportsTitleAccent')}</span></h2>
              <p>{text('reportsLead')}</p>
            </div>
            <div className="admin-landing__reports-grid">
              <article className="admin-landing__report-card admin-landing__report-card--income">
                <div className="admin-landing__report-card-visual" aria-hidden="true"><i /><i /><i /><i /><b>↗</b></div>
                <h3>{text('reportIncome')}</h3><p>{text('reportIncomeText')}</p>
              </article>
              <article className="admin-landing__report-card admin-landing__report-card--detail">
                <div className="admin-landing__report-card-visual" aria-hidden="true">
                  <div><b>14</b><span>18:30 · CANCHA 2</span><em>$ 42K</em></div>
                  <div><b>15</b><span>TORNEO · INSCRIPCIÓN</span><em>✓</em></div>
                </div>
                <h3>{text('reportDetail')}</h3><p>{text('reportDetailText')}</p>
              </article>
              <article className="admin-landing__report-card admin-landing__report-card--export">
                <div className="admin-landing__report-card-visual" aria-hidden="true"><div><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><b>↓ XLSX</b></div>
                <h3>{text('reportExport')}</h3><p>{text('reportExportText')}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="admin-landing__section" id="recorrido">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">{text('modulesEyebrow')}</p>
            <h2>{text('modulesTitle')}<span>{text('modulesTitleAccent')}</span></h2>
            <p className="admin-landing__intro">{text('modulesLead')}</p>
            <div className="admin-landing__module-grid">
              {modules.map((module) => (
                <article
                  key={module.number}
                  className="admin-landing__module-card"
                >
                  <span>{module.number}</span><h3>{module.title}</h3><p>{module.description}</p>
                </article>
              ))}
            </div>
            <div className="admin-landing__modules-cta">
              <Link to="/planes" className="admin-landing__primary">
                {text('modulesCta')} <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="admin-landing__data-ownership" aria-labelledby="datos-propios-title">
          <div className="admin-landing__shell admin-landing__data-ownership-grid">
            <div className="admin-landing__data-ownership-visual">
              <p className="admin-landing__data-ownership-kicker">{text('dataKicker')}</p>
              <img src={dataOwnershipVisual} alt={text('dataVisualAlt')} />
            </div>
            <div className="admin-landing__data-ownership-copy">
              <h2 id="datos-propios-title">{text('dataTitle')}<span>{text('dataTitleAccent')}</span></h2>
              <p className="admin-landing__data-ownership-lead">{text('dataLead')}</p>
              <p>{text('dataText')}</p>
              <div className="admin-landing__data-ownership-points" aria-label={text('dataAria')}>
                <span>{text('dataBring')}</span><span>{text('dataBuild')}</span><span>{text('dataTake')}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-landing__guided" id="asistente">
          <div className="admin-landing__shell admin-landing__guided-grid">
            <div>
              <p className="admin-landing__eyebrow">{text('guidedEyebrow')}</p>
              <h2>{text('guidedTitle')}<span>{text('guidedTitleAccent')}</span></h2>
              <p className="admin-landing__intro">{text('guidedLead')}</p>
              <div className="admin-landing__assistant-features" aria-label={text('featuresAria')}>
                <span>◉ {text('voiceOrText')}</span><span>✓ {text('validates')}</span><span>→ {text('opensModule')}</span>
              </div>
              <p className="admin-landing__human-support"><strong>{text('humanSupport')}</strong> {text('humanSupportText')}</p>
              <ul className="admin-landing__check-list">
                <li>{text('check1')}</li><li>{text('check2')}</li><li>{text('check3')}</li><li>{text('check4')}</li>
              </ul>
              <p className="admin-landing__note"><strong>{text('howItWorks')}</strong> {text('howItWorksText')}</p>
            </div>
            <div className="admin-landing__conversation admin-landing__conversation--listening" aria-label={text('conversationAria')}>
              <p className="admin-landing__panel-label">{text('assistantLabel')}</p>
              <div className="admin-landing__chivi-pulse" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i />
              </div>
              <strong className="admin-landing__chivi-title">{text('listening')}</strong>
              <p className="admin-landing__chivi-copy">{text('listeningText')}</p>
            </div>
          </div>
        </section>

        <section className="admin-landing__cta">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">{text('closingEyebrow')}</p>
            <h2>{text('closingTitle')}<span>{text('closingTitleAccent')}</span></h2>
            <p>{text('closingText')}</p>
            <div className="admin-landing__hero-actions"><Link to="/planes" className="admin-landing__primary">{text('plansCta')} <span>→</span></Link></div>
          </div>
        </section>
      </main>

    </div>
    </PublicSiteLayout>
  );
}
