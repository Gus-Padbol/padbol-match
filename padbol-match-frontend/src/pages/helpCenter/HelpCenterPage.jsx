import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {usePadbolI18n} from '../../context/PadbolI18nContext';
import {normalizeHelpLanguage, searchHelp} from './helpCenterContent';
import {articleCopy, helpCopy} from './helpCenterUI';
import {HelpCenterTop, SupportCard} from './HelpCenterParts';
import './HelpCenterPage.css';

function ResultCard({article, lang, copy}) {
  const text = articleCopy(article, lang);
  return (
    <Link className="hc-result" to={`/ayuda/${article.module}/${article.slug}`}>
      <span className="hc-result-top">
        <span className="hc-badge">{copy.verifiedShort}</span>
        <span className="hc-result-category">{copy.category}: {text.categoryLabel}</span>
      </span>
      <strong>{text.title}</strong>
      <span className="hc-result-purpose">{text.purpose}</span>
      <span className="hc-result-action">{copy.readArticle} <span aria-hidden="true">→</span></span>
    </Link>
  );
}

export default function HelpCenterPage() {
  const {language} = usePadbolI18n();
  const lang = normalizeHelpLanguage(language);
  const copy = helpCopy(lang);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);
  const headingRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    headingRef.current?.focus({preventScroll: true});
  }, [lang]);

  const outcome = useMemo(() => searchHelp(query, lang), [query, lang]);
  const results = outcome.results;
  const showNoResults = Boolean(query) && results.length === 0;

  function submitSearch(event) {
    event.preventDefault();
    const next = input.trim();
    setSearchParams(next ? {q: next} : {});
    window.setTimeout(() => resultsRef.current?.focus({preventScroll: true}), 0);
  }

  function clearSearch() {
    setInput('');
    setSearchParams({});
    window.setTimeout(() => headingRef.current?.focus({preventScroll: true}), 0);
  }

  return (
    <div className="hc-page">
      <div className="hc-shell">
        <HelpCenterTop copy={copy} />
        <main id="hc-main" className="hc-main">
          <header className="hc-header">
            <p className="hc-kicker">{copy.helpCenter}</p>
            <h1 ref={headingRef} tabIndex={-1}>{copy.title}</h1>
            <p className="hc-lead">{copy.intro}</p>
          </header>

          <form className="hc-search" role="search" onSubmit={submitSearch}>
            <label htmlFor="hc-search-input">{copy.searchLabel}</label>
            <div className="hc-search-row">
              <input
                id="hc-search-input"
                type="search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={copy.searchPlaceholder}
                autoComplete="off"
              />
              <button type="submit" className="hc-button">{copy.search}</button>
              {query ? (
                <button type="button" className="hc-clear" onClick={clearSearch}>{copy.clear}</button>
              ) : null}
            </div>
          </form>

          <section className="hc-results" aria-labelledby="hc-results-title" ref={resultsRef} tabIndex={-1}>
            <div className="hc-section-head">
              <h2 id="hc-results-title">{query ? copy.searchResults : copy.allTopics}</h2>
              <span aria-live="polite">
                {results.length} {results.length === 1 ? copy.result : copy.results}
              </span>
            </div>
            {showNoResults ? (
              <div className="hc-empty">
                <h3>{copy.noResults}</h3>
                <p>{copy.noResultsHint}</p>
              </div>
            ) : (
              <div className="hc-result-list">
                {results.map((article) => (
                  <ResultCard key={article.id} article={article} lang={lang} copy={copy} />
                ))}
              </div>
            )}
          </section>

          <section className="hc-admin-guide" aria-labelledby="hc-admin-guide-title">
            <h2 id="hc-admin-guide-title">{copy.adminGuideTitle}</h2>
            <p>{copy.adminGuideLead}</p>
            <Link className="hc-button" to="/ayuda/administracion">{copy.adminGuideAction}</Link>
          </section>

          <SupportCard copy={copy} />
        </main>
      </div>
    </div>
  );
}

