import React, {useEffect, useRef} from 'react';
import {Link, useParams} from 'react-router-dom';
import {usePadbolI18n} from '../../context/PadbolI18nContext';
import {getPublicArticle, normalizeHelpLanguage} from './helpCenterContent';
import {articleCopy, helpCopy} from './helpCenterUI';
import {HelpCenterNotFound, HelpCenterTop, SupportCard} from './HelpCenterParts';
import './HelpCenterPage.css';

export default function HelpCenterArticlePage() {
  const {module, slug} = useParams();
  const {language} = usePadbolI18n();
  const lang = normalizeHelpLanguage(language);
  const copy = helpCopy(lang);
  const article = getPublicArticle(module, slug);
  const text = article ? articleCopy(article, lang) : null;
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus({preventScroll: true});
  }, [article?.id, lang]);

  if (!article || !text) return <HelpCenterNotFound copy={copy} />;

  return (
    <div className="hc-page">
      <div className="hc-shell">
        <HelpCenterTop copy={copy} />
        <main id="hc-main" className="hc-main">
          <Link className="hc-back" to="/ayuda"><span aria-hidden="true">←</span> {copy.back}</Link>
          <article className="hc-article">
            <header className="hc-article-head">
              <p className="hc-kicker">{copy.article} · {text.categoryLabel}</p>
              <div className="hc-article-badges">
                <span className="hc-badge">{copy.verifiedShort}</span>
                <span className="hc-scope-note">{copy.verifiedOn}: {article.verifiedAt}</span>
              </div>
              <h1 ref={headingRef} tabIndex={-1}>{text.title}</h1>
              <p className="hc-lead">{text.purpose}</p>
            </header>

            <div className="hc-meta">
              <div>
                <span>{copy.scope}</span>
                <p>{text.scope}</p>
              </div>
              <div>
                <span>{copy.audience}</span>
                <p>{text.audience}</p>
              </div>
            </div>

            {text.note ? (
              <p className="hc-warning">{text.note}</p>
            ) : null}

            <section className="hc-section">
              <h2>{copy.requirements}</h2>
              <ul className="hc-list">
                {text.requirements.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="hc-section">
              <h2>{copy.steps}</h2>
              <ol className="hc-steps">
                {text.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>

            <section className="hc-section">
              <h2>{copy.issues}</h2>
              <ul className="hc-list">
                {text.issues.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="hc-section">
              <h2>{copy.visual}</h2>
              <ul className="hc-chips" aria-label={copy.visual}>
                {text.visualFields.map((field) => <li key={field}>{field}</li>)}
              </ul>
            </section>
          </article>

          <SupportCard copy={copy} />
        </main>
      </div>
    </div>
  );
}
