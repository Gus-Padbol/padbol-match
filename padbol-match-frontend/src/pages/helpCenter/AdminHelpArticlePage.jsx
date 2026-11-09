import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePadbolI18n } from '../../context/PadbolI18nContext';
import useAdminHelpScopeKey from '../../utils/adminHelpScope';
import { adminHelpApi } from '../../utils/adminHelpApi';
import { HelpCenterTop } from './HelpCenterParts';
import { helpCopy } from './helpCenterUI';
import './HelpCenterPage.css';
import './AdminHelpPage.css';

const COPY = {
  es: { back:'Volver a la guía', title:'Guía del administrador', requirements:'Antes de empezar', steps:'Paso a paso', limit:'Importante', review:'Revisión', reviewedOn:'9 de noviembre de 2026', signIn:'Inicia sesión para ver la guía.', denied:'No tienes permiso para ver este contenido.', unavailable:'Este contenido no está disponible en el idioma seleccionado.', notFound:'No encontramos este artículo.', loadError:'No se pudo cargar el artículo.', loading:'Cargando…', retry:'Reintentar' },
  en: { back:'Back to guide', title:'Administrator guide', requirements:'Before you start', steps:'Step by step', limit:'Important', review:'Reviewed', reviewedOn:'November 9, 2026', signIn:'Sign in to view the guide.', denied:'You do not have permission to view this content.', unavailable:'This content is not available in the selected language.', notFound:'We could not find this article.', loadError:'Could not load the article.', loading:'Loading…', retry:'Retry' },
  pt: { back:'Voltar à guia', title:'Guia do administrador', requirements:'Antes de começar', steps:'Passo a passo', limit:'Importante', review:'Revisão', reviewedOn:'9 de novembro de 2026', signIn:'Entre para ver a guia.', denied:'Você não tem permissão para ver este conteúdo.', unavailable:'Este conteúdo não está disponível no idioma selecionado.', notFound:'Não encontramos este artigo.', loadError:'Não foi possível carregar o artigo.', loading:'Carregando…', retry:'Tentar novamente' },
};
const LANGS = ['es','en','pt'];
function normalizeLang(value) { const raw=String(value||'').toLowerCase(); return raw.startsWith('pt')?'pt':raw.startsWith('en')?'en':'es'; }

export default function AdminHelpArticlePage() {
  const { module, slug } = useParams();
  const { session } = useAuth();
  const { language } = usePadbolI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lang, setLang] = useState(normalizeLang(searchParams.get('lang') || language));
  const [article, setArticle] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const token = session?.access_token;
  const sessionKey = `${session?.user?.id || ''}:${token || ''}`;
  const scopeKey = useAdminHelpScopeKey();
  const copy = COPY[lang];

  function changeLang(nextLang) {
    setLang(nextLang);
    const params = new URLSearchParams(searchParams);
    params.set('lang', nextLang);
    setSearchParams(params, { replace: true });
  }
  function retry() { setRetryTick((value) => value + 1); }
  function isTransient(errorValue) { const status = Number(errorValue?.status); return !status || status >= 500; }
  function backHref() {
    const params = new URLSearchParams({ lang });
    const q = searchParams.get('q');
    const category = searchParams.get('category');
    if (q) params.set('q', q);
    if (category && category !== 'all') params.set('category', category);
    return `/ayuda/administracion?${params.toString()}`;
  }

  useEffect(() => {
    const nextLang = normalizeLang(searchParams.get('lang') || language);
    setLang(nextLang);
  }, [searchParams, language]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!token) { setLoading(false); setArticle(null); setError({ status:401 }); return () => { active=false; controller.abort(); }; }
    setLoading(true); setArticle(null); setError(null);
    adminHelpApi.getArticle(token, module, slug, { lang, signal: controller.signal })
      .then((data) => { if (active) setArticle(data?.article || null); })
      .catch((err) => { if (!active || err?.name === 'AbortError') return; setArticle(null); setError({ status: err?.status || err?.code || null }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active=false; controller.abort(); };
  }, [token, sessionKey, scopeKey, module, slug, lang, retryTick]);

  const errorCopy = error?.status === 401 ? copy.signIn : error?.status === 403 ? copy.denied : error?.status === 409 ? copy.unavailable : error?.status === 404 ? copy.notFound : copy.loadError;
  return (
    <div className="hc-page admin-help-page">
      <div className="hc-shell">
        <HelpCenterTop copy={helpCopy(lang)} />
        <main id="hc-main" className="hc-main" data-reload={retryTick}>
          <Link className="admin-help-back" to={backHref()}>← {copy.back}</Link>
          <div className="admin-help-langs" aria-label="Language">
            {LANGS.map((id) => <button key={id} type="button" aria-pressed={lang === id} onClick={() => changeLang(id)}>{id.toUpperCase()}</button>)}
          </div>
          {loading ? <div className="admin-help-state">{copy.loading}</div> : error ? <div className="admin-help-state" role="alert"><p>{errorCopy}</p>{isTransient(error) ? <button type="button" className="hc-button" onClick={retry}>{copy.retry}</button> : null}</div> : article ? (
            <article className="admin-help-detail">
              <header>
                <p className="hc-kicker">{copy.title} · {article.module}</p>
                <h1>{article.title}</h1>
                <p className="admin-help-meta">{copy.review}: {copy.reviewedOn}</p>
              </header>
              <section><h2>{copy.requirements}</h2><ul>{(article.requirements || []).map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><h2>{copy.steps}</h2><ol>{(article.steps || []).map((item) => <li key={item}>{item}</li>)}</ol></section>
              {article.limit ? <p className="admin-help-limit"><strong>{copy.limit}:</strong> {article.limit}</p> : null}
            </article>
          ) : <div className="admin-help-state">{copy.notFound}</div>}
        </main>
      </div>
    </div>
  );
}
