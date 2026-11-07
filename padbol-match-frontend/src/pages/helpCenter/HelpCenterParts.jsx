import React from 'react';
import {Link} from 'react-router-dom';

export function HelpCenterTop({copy}) {
  return (
    <>
      <a className="hc-skip" href="#hc-main">{copy.skipToContent}</a>
      <header className="hc-top">
        <Link className="hc-brand" to="/">{copy.brand}</Link>
        <nav className="hc-nav" aria-label={copy.helpCenter}>
          <Link to="/">{copy.home}</Link>
          <Link to="/ayuda" aria-current="page">{copy.helpCenter}</Link>
        </nav>
      </header>
    </>
  );
}

export function SupportCard({copy}) {
  return (
    <section className="hc-support" aria-labelledby="hc-support-title">
      <div>
        <p className="hc-kicker">{copy.support}</p>
        <h2 id="hc-support-title" style={{color: '#fff'}}>{copy.supportNotice}</h2>
        <p>{copy.supportNote}</p>
      </div>
      <Link className="hc-button" to="/soporte" style={{color: '#0f172a', background: '#fff', borderColor: '#fff'}}>{copy.support}</Link>
    </section>
  );
}

export function HelpCenterNotFound({copy}) {
  return (
    <div className="hc-page">
      <div className="hc-shell">
        <HelpCenterTop copy={copy} />
        <main id="hc-main" className="hc-main">
          <section className="hc-empty">
            <p className="hc-kicker">404</p>
            <h1>{copy.notFoundTitle}</h1>
            <p>{copy.notFoundBody}</p>
            <div className="hc-actions">
              <Link className="hc-button" to="/ayuda">{copy.notFoundBack}</Link>
            </div>
          </section>
          <SupportCard copy={copy} />
        </main>
      </div>
    </div>
  );
}
