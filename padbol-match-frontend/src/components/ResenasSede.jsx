import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { getPublicApiBaseUrl } from '../utils/apiPublicBaseUrl';
import './ResenasSede.css';

const toHttps = (url) => (url ? String(url).replace(/^http:\/\//, 'https://') : url);

const RESENA_MAX_CHARS = 500;
const LIST_LIMIT = 50;

const API_BASE =
  getPublicApiBaseUrl() ||
  (typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com');

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return toHttps(`${API_BASE}${p}`);
}

const EMPTY_PAYLOAD = {
  resenas: [],
  promedio: null,
  total: 0,
  ya_reseño: false,
  puede_reseñar: false,
};

function formatFechaResena(iso, locale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function resenaDisplayName(r) {
  const nombrePartes = [r?.autor?.nombre, r?.autor?.apellido].filter(Boolean).join(' ').trim();
  return String(r?.display_name || nombrePartes || r?.nombre || '').trim() || 'Jugador';
}

function resenaAvatarUrl(r) {
  const raw = r?.foto_url ?? r?.autor?.foto_url ?? r?.avatar_url ?? r?.autor?.avatar_url;
  return raw ? toHttps(String(raw).trim()) : '';
}

function EstrellasLectura({ value, size = 'md' }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span
      className={`reseñas-sede__stars${size === 'lg' ? ' reseñas-sede__stars--lg' : ''}`}
      aria-label={`${v} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`reseñas-sede__star ${i <= v ? 'reseñas-sede__star--on' : 'reseñas-sede__star--off'}`}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  );
}

function EstrellasSelector({ value, onChange, disabled, label }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <div className="reseñas-sede__stars reseñas-sede__stars--interactive" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className={`reseñas-sede__star-btn${v >= n ? ' reseñas-sede__star-btn--on' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} de 5 estrellas`}
          aria-pressed={v >= n}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ResenaItem({ resena, dateLocale, t }) {
  const displayName = resenaDisplayName(resena);
  const foto = resenaAvatarUrl(resena);
  const ini = displayName.charAt(0).toUpperCase() || '?';
  const reply = String(resena?.respuesta_admin || '').trim();

  return (
    <article className="reseñas-sede__item">
      <div className="reseñas-sede__avatar">
        {foto ? (
          <img src={foto} alt="" />
        ) : (
          <div className="reseñas-sede__avatar-fallback" aria-hidden>
            {ini}
          </div>
        )}
      </div>
      <div className="reseñas-sede__body">
        <div className="reseñas-sede__head">
          <span className="reseñas-sede__name">{displayName}</span>
          <EstrellasLectura value={resena.estrellas} />
          <span className="reseñas-sede__date">{formatFechaResena(resena.created_at, dateLocale)}</span>
        </div>
        {String(resena.comentario || '').trim() ? (
          <p className="reseñas-sede__comment">{resena.comentario}</p>
        ) : null}
        {reply ? (
          <div className="reseñas-sede__reply">
            <div className="reseñas-sede__reply-label">{t('resenas.clubReply')}</div>
            <p className="reseñas-sede__reply-text">{reply}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Reseñas públicas de una sede: promedio, listado y formulario para dejar reseña.
 */
export default function ResenasSede({ sedeId, accessToken, navigate, className = '' }) {
  const { t, i18n } = useTranslation();
  const idNum = useMemo(() => parseInt(String(sedeId), 10), [sedeId]);
  const dateLocale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estrellasForm, setEstrellasForm] = useState(0);
  const [comentarioForm, setComentarioForm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const loadResenas = useCallback(async () => {
    if (!Number.isFinite(idNum)) return;
    setLoading(true);
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const url = apiUrl(`/api/sedes/${idNum}/resenas?limit=${LIST_LIMIT}&offset=0`);
    try {
      const r = await fetch(url, { headers });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPayload({ ...EMPTY_PAYLOAD });
        return;
      }
      setPayload({
        ...EMPTY_PAYLOAD,
        ...body,
        resenas: Array.isArray(body.resenas) ? body.resenas : [],
        total: Number(body.total ?? body.total_count ?? 0) || 0,
        ya_reseño: Boolean(body.ya_reseño ?? body.user_has_reviewed),
        puede_reseñar: Boolean(body.puede_reseñar ?? body.user_is_eligible),
      });
    } catch {
      setPayload({ ...EMPTY_PAYLOAD });
    } finally {
      setLoading(false);
    }
  }, [idNum, accessToken]);

  useEffect(() => {
    void loadResenas();
  }, [loadResenas]);

  const submitResena = async (e) => {
    e.preventDefault();
    if (!accessToken) return;
    setFormMsg('');
    const est = parseInt(String(estrellasForm), 10);
    if (!Number.isFinite(est) || est < 1 || est > 5) {
      setFormMsg(t('resenas.pickStars'));
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(apiUrl(`/api/sedes/${idNum}/resenas`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ estrellas: est, comentario: comentarioForm.trim() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(body.error || t('resenas.submitError'));
      }
      setComentarioForm('');
      setEstrellasForm(0);
      setFormMsg(t('resenas.submitSuccess'));
      await loadResenas();
    } catch (err) {
      setFormMsg(err.message || t('resenas.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!Number.isFinite(idNum)) return null;

  const lista = Array.isArray(payload?.resenas) ? payload.resenas : [];
  const promedioTxt =
    payload?.promedio != null && Number.isFinite(Number(payload.promedio))
      ? Number(payload.promedio).toFixed(1)
      : '—';
  const promedioNum = Number(payload?.promedio);
  const estrellasPromedio = Number.isFinite(promedioNum) ? Math.round(promedioNum) : 0;
  const total = Number(payload?.total) || 0;

  return (
    <section className={`reseñas-sede${className ? ` ${className}` : ''}`} aria-labelledby="reseñas-sede-title">
      <h2 id="reseñas-sede-title" className="reseñas-sede__title">
        {t('resenas.title')}
      </h2>

      {loading ? (
        <p className="reseñas-sede__loading">{t('resenas.loading')}</p>
      ) : (
        <>
          <div className="reseñas-sede__summary">
            <span className="reseñas-sede__avg">{promedioTxt}</span>
            <div className="reseñas-sede__summary-meta">
              <EstrellasLectura value={estrellasPromedio} size="lg" />
              <span className="reseñas-sede__total">
                {total > 0
                  ? t('resenas.totalCount', { count: total })
                  : t('resenas.noReviewsYet')}
              </span>
            </div>
          </div>

          {!accessToken ? (
            <p className="reseñas-sede__hint">
              <button
                type="button"
                className="reseñas-sede__login-link"
                onClick={() => (navigate ? navigate('/auth') : (window.location.href = '/auth'))}
              >
                {t('resenas.loginToReview')}
              </button>{' '}
              {t('resenas.loginSuffix')}
            </p>
          ) : payload?.ya_reseño ? (
            <p className="reseñas-sede__hint">{t('resenas.alreadyReviewed')}</p>
          ) : payload?.puede_reseñar ? (
            <form className="reseñas-sede__form" onSubmit={submitResena}>
              <label className="reseñas-sede__form-label" htmlFor="reseñas-sede-stars">
                {t('resenas.ratingLabel')} <span style={{ color: 'var(--accent, #e11b22)' }}>*</span>
              </label>
              <EstrellasSelector
                value={estrellasForm}
                onChange={setEstrellasForm}
                disabled={submitting}
                label={t('resenas.ratingLabel')}
              />
              <label className="reseñas-sede__form-label reseñas-sede__form-label--mt" htmlFor="reseñas-sede-comentario">
                {t('resenas.commentLabel', { max: RESENA_MAX_CHARS })}
              </label>
              <textarea
                id="reseñas-sede-comentario"
                className="reseñas-sede__textarea"
                value={comentarioForm}
                maxLength={RESENA_MAX_CHARS}
                disabled={submitting}
                onChange={(ev) => setComentarioForm(ev.target.value)}
                rows={3}
              />
              <div className="reseñas-sede__form-footer">
                <span className="reseñas-sede__char-count">
                  {comentarioForm.length}/{RESENA_MAX_CHARS}
                </span>
                <button type="submit" className="reseñas-sede__submit" disabled={submitting}>
                  {submitting ? t('resenas.submitting') : t('resenas.submit')}
                </button>
              </div>
              {formMsg ? (
                <p
                  className={`reseñas-sede__form-msg ${
                    formMsg === t('resenas.submitSuccess') ? 'reseñas-sede__form-msg--ok' : 'reseñas-sede__form-msg--err'
                  }`}
                >
                  {formMsg}
                </p>
              ) : null}
            </form>
          ) : (
            <p className="reseñas-sede__hint">{t('resenas.needConfirmedBooking')}</p>
          )}

          {lista.length === 0 ? (
            <p className="reseñas-sede__empty">{t('resenas.emptyList')}</p>
          ) : (
            <div className="reseñas-sede__list">
              {lista.map((row, idx) => (
                <ResenaItem key={row?.id ?? `resena-${idx}`} resena={row} dateLocale={dateLocale} t={t} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
