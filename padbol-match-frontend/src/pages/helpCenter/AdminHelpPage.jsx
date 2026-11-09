import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePadbolI18n } from '../../context/PadbolI18nContext';
import useAdminHelpScopeKey from '../../utils/adminHelpScope';
import { adminHelpApi } from '../../utils/adminHelpApi';
import { HelpCenterTop } from './HelpCenterParts';
import { helpCopy } from './helpCenterUI';
import './HelpCenterPage.css';
import './AdminHelpPage.css';

const LANGS = [
  { id: 'es', label: 'ES' },
  { id: 'en', label: 'EN' },
  { id: 'pt', label: 'PT' },
];
const MODULES = {
  administracion: { es: 'Administración', en: 'Administration', pt: 'Administração' },
  soporte: { es: 'Soporte', en: 'Support', pt: 'Suporte' },
  sedes: { es: 'Sedes y canchas', en: 'Venues and courts', pt: 'Sedes e quadras' },
  reservas: { es: 'Reservas', en: 'Bookings', pt: 'Reservas' },
  validaciones: { es: 'Validaciones', en: 'Validations', pt: 'Validações' },
  torneos: { es: 'Torneos', en: 'Tournaments', pt: 'Torneios' },
  marcador: { es: 'Marcador', en: 'Scoreboard', pt: 'Placar' },
  jugadores: { es: 'Jugadores', en: 'Players', pt: 'Jogadores' },
  membresias: { es: 'Membresías y PadCoins', en: 'Memberships and PadCoins', pt: 'Membresias e PadCoins' },
  incentivos: { es: 'Incentivos', en: 'Incentives', pt: 'Incentivos' },
  notificaciones: { es: 'Notificaciones', en: 'Notifications', pt: 'Notificações' },
  configuracion: { es: 'Configuración', en: 'Settings', pt: 'Configuração' },
};
const COPY = {
  es: { title:'Guía del administrador', intro:'Instrucciones revisadas para administrar tu sede. El acceso se valida al ingresar; una pestaña visible no concede permisos.', back:'Volver a Ayuda', search:'Buscar', placeholder:'Buscar en la guía', all:'Todas las categorías', results:'resultados', verified:'Revisado', noResults:'No hay contenido para esta búsqueda.', denied:'No tienes permiso para ver esta guía.', signIn:'Inicia sesión para ver la guía.', unavailable:'La guía no está disponible en este idioma.', loadError:'No se pudo cargar la guía. Intenta nuevamente.', loading:'Cargando…', review:'Revisión', limit:'Importante', retry:'Reintentar' },
  en: { title:'Administrator guide', intro:'Reviewed instructions for managing your venue. Access is validated at sign-in; a visible tab does not grant permission.', back:'Back to Help', search:'Search', placeholder:'Search the guide', all:'All categories', results:'results', verified:'Reviewed', noResults:'No content matches this search.', denied:'You do not have permission to view this guide.', signIn:'Sign in to view the guide.', unavailable:'This guide is not available in this language.', loadError:'Could not load the guide. Try again.', loading:'Loading…', review:'Reviewed', limit:'Important', retry:'Retry' },
  pt: { title:'Guia do administrador', intro:'Instruções revisadas para administrar sua sede. O acesso é validado ao entrar; uma aba visível não concede permissão.', back:'Voltar à Ajuda', search:'Buscar', placeholder:'Buscar na guia', all:'Todas as categorias', results:'resultados', verified:'Revisado', noResults:'Nenhum conteúdo para esta busca.', denied:'Você não tem permissão para ver esta guia.', signIn:'Entre para ver a guia.', unavailable:'A guia não está disponível neste idioma.', loadError:'Não foi possível carregar a guia. Tente novamente.', loading:'Carregando…', review:'Revisão', limit:'Importante', retry:'Tentar novamente' },
};

function normalizeLang(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('pt')) return 'pt';
  if (raw.startsWith('en')) return 'en';
  return 'es';
}
function moduleLabel(module, lang) {
  return MODULES[module]?.[lang] || String(module || '');
}
function adminArticlePath(module, slug, { lang = 'es', q = '', category = 'all' } = {}) {
  const params = new URLSearchParams({ lang });
  if (q) params.set('q', q);
  if (category !== 'all') params.set('category', category);
  return `/ayuda/administracion/${encodeURIComponent(module)}/${encodeURIComponent(slug)}?${params.toString()}`;
}
function safeCode(error) {
  return error?.status || error?.code || null;
}

export default function AdminHelpPage() {
  const { session } = useAuth();
  const { language } = usePadbolI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLang = normalizeLang(searchParams.get('lang') || language);
  const [lang, setLang] = useState(initialLang);
  const [input, setInput] = useState(searchParams.get('q') || '');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const copy = COPY[lang];
  const token = session?.access_token;
  const sessionKey = `${session?.user?.id || ''}:${token || ''}`;
  const scopeKey = useAdminHelpScopeKey();

  function updateUrl(next = {}) {
    const nextLang = next.lang ?? lang;
    const nextQuery = next.q ?? query;
    const nextCategory = next.category ?? category;
    const params = new URLSearchParams({ lang: nextLang });
    if (nextQuery) params.set('q', nextQuery);
    if (nextCategory !== 'all') params.set('category', nextCategory);
    setSearchParams(params, { replace: true });
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!token) {
      setResults([]); setLoading(false); setError({ status: 401 });
      return () => { active = false; controller.abort(); };
    }
    setResults([]); setLoading(true); setError(null);
    adminHelpApi.search(token, { q: query, lang, signal: controller.signal })
      .then((data) => { if (active) setResults(Array.isArray(data?.results) ? data.results : []); })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return;
        setResults([]); setError({ status: safeCode(err), code: err?.code || null });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [token, sessionKey, scopeKey, query, lang, retryTick]);

  useEffect(() => {
    const nextQ = searchParams.get('q') || '';
    const nextLang = normalizeLang(searchParams.get('lang') || language);
    const nextCategory = searchParams.get('category') || 'all';
    setInput(nextQ); setQuery(nextQ); setLang(nextLang); setCategory(nextCategory);
  }, [searchParams, language]);

  const categories = useMemo(() => {
    const seen = new Set();
    return results.map((item) => item.module).filter((module) => {
      if (!module || seen.has(module)) return false;
      seen.add(module); return true;
    });
  }, [results]);
  const visible = category === 'all' ? results : results.filter((item) => item.module === category);

  function submit(event) {
    event.preventDefault();
    const nextQuery = input.trim();
    setCategory('all');
    setQuery(nextQuery);
    setRetryTick((value) => value + 1);
    updateUrl({ q: nextQuery, category: 'all' });
  }
  function changeLang(nextLang) { setLang(nextLang); updateUrl({ lang: nextLang }); }
  function changeCategory(nextCategory) { setCategory(nextCategory); updateUrl({ category: nextCategory }); }
  function retry() { setRetryTick((value) => value + 1); }
  function isTransient(errorValue) { const status = Number(errorValue?.status); return !status || status >= 500; }

  if (!token) {
    return <div className="hc-page admin-help-page"><div className="hc-shell"><HelpCenterTop copy={copy} /><main className="hc-main"><div className="admin-help-state">{copy.signIn}</div></main></div></div>;
  }

  return (
    <div className="hc-page admin-help-page">
      <div className="hc-shell">
        <HelpCenterTop copy={helpCopy(lang)} />
        <main id="hc-main" className="hc-main" data-reload={retryTick}>
          <Link className="admin-help-back" to="/ayuda">← {copy.back}</Link>
          <header className="admin-help-header">
            <div><p className="hc-kicker">PADBOL MATCH · ADMIN</p><h1>{copy.title}</h1><p className="hc-lead">{copy.intro}</p></div>
          </header>
          <form className="admin-help-search" role="search" onSubmit={submit}>
            <label htmlFor="admin-help-search-input" className="sr-only">{copy.search}</label>
            <input id="admin-help-search-input" type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder={copy.placeholder} autoComplete="off" />
            <button className="hc-button" type="submit">{copy.search}</button>
          </form>
          <div className="admin-help-controls">
            <div className="admin-help-categories" aria-label={copy.all}>
              <button type="button" aria-pressed={category === 'all'} onClick={() => changeCategory('all')}>{copy.all}</button>
              {categories.map((module) => <button key={module} type="button" aria-pressed={category === module} onClick={() => changeCategory(module)}>{moduleLabel(module, lang)}</button>)}
            </div>
            <div className="admin-help-langs" aria-label="Language">
              {LANGS.map((item) => <button key={item.id} type="button" aria-pressed={lang === item.id} onClick={() => changeLang(item.id)}>{item.label}</button>)}
            </div>
          </div>
          {error ? (
            <div className="admin-help-state" role="alert">
              <p>{error.status === 401 ? copy.signIn : error.status === 403 ? copy.denied : error.status === 409 ? copy.unavailable : copy.loadError}</p>
              {isTransient(error) ? <button type="button" className="hc-button" onClick={retry}>{copy.retry}</button> : null}
            </div>
          ) : loading ? (
            <div className="admin-help-state">{copy.loading}</div>
          ) : visible.length === 0 ? (
            <div className="admin-help-state">{copy.noResults}</div>
          ) : (
            <section aria-live="polite">
              <p className="admin-help-meta">{visible.length} {copy.results}</p>
              <div className="admin-help-results">
                {visible.map((item) => (
                  <Link className="admin-help-card" key={`${item.module}:${item.slug}`} to={adminArticlePath(item.module, item.slug, { lang, q: query, category })}>
                    <span className="hc-badge">{copy.verified}</span>
                    <h3>{item.title}</h3>
                    <p>{item.snippet || ''}</p>
                    <span className="admin-help-meta">{moduleLabel(item.module, lang)} · {copy.verified}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
