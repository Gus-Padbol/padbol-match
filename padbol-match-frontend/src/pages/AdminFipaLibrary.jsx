import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { getApiBaseUrl, getPublicApiBaseUrl } from '../utils/apiPublicBaseUrl';
import { padbolLangToIntlLocale } from '../utils/padbolLang';
import './AdminFipaLibrary.css';

const BASE = `${getPublicApiBaseUrl() || getApiBaseUrl()}/api/admin/fipa/biblioteca`;
const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

export function isActiveGrant(grant, now = Date.now()) {
  if (grant?.status !== 'active') return false;
  if (!grant.expires_at) return true;
  const expiresAt = Date.parse(grant.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function formatAdminDate(value, locale, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export function resolveGrantAccount(grant, requests) {
  const relatedRequest = (requests || []).find((request) => (
    request.id === grant?.request_id || request.user_id === grant?.user_id
  ));
  return grant?.email_snapshot
    || grant?.user_email
    || relatedRequest?.email_snapshot
    || grant?.user_id
    || '';
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

export default function AdminFipaLibrary() {
  const { session } = useAuth();
  const { t, language } = useTranslation();
  const token = session?.access_token;
  const locale = padbolLangToIntlLocale(language);
  const [status, setStatus] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [grants, setGrants] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  const call = useCallback(async (path, options = {}) => {
    if (!token) throw new Error(t('fipaAdminLibrary.errors.session'));
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(body.error || t('fipaAdminLibrary.errors.generic'));
    return body;
  }, [t, token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      call(`/solicitudes?status=${encodeURIComponent(status)}`, { signal: controller.signal }),
      call('/habilitaciones', { signal: controller.signal }),
    ]).then(([requestBody, grantBody]) => {
      if (controller.signal.aborted) return;
      setRequests(Array.isArray(requestBody.requests) ? requestBody.requests : []);
      setGrants(Array.isArray(grantBody.grants) ? grantBody.grants : []);
    }).catch((loadError) => {
      if (!controller.signal.aborted) {
        setRequests([]);
        setGrants([]);
        setError(loadError.message || t('fipaAdminLibrary.errors.generic'));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [call, reload, status, t]);

  const activeGrants = useMemo(() => grants.filter((grant) => isActiveGrant(grant)), [grants]);

  function updateNote(key, value) {
    setNotes((current) => ({ ...current, [key]: value }));
  }

  async function act(id, decision) {
    const noteKey = `${decision === 'revoke' ? 'grant' : 'request'}:${id}`;
    const note = String(notes[noteKey] || '').trim();
    if (!note) {
      setMessage('');
      setError(decision === 'revoke'
        ? t('fipaAdminLibrary.validation.revokeNote')
        : t('fipaAdminLibrary.validation.decisionNote'));
      return;
    }

    const currentAction = `${decision}:${id}`;
    setActionKey(currentAction);
    setError('');
    setMessage('');
    try {
      await call(decision === 'revoke' ? `/habilitaciones/${id}/revocar` : `/solicitudes/${id}`, {
        method: decision === 'revoke' ? 'POST' : 'PATCH',
        body: JSON.stringify(decision === 'revoke'
          ? { reason: note }
          : { decision, review_note: note }),
      });
      setNotes((current) => {
        const next = { ...current };
        delete next[noteKey];
        return next;
      });
      setMessage(t(`fipaAdminLibrary.success.${decision}`));
      setReload((value) => value + 1);
    } catch (actionError) {
      setError(actionError.message || t('fipaAdminLibrary.errors.generic'));
    } finally {
      setActionKey('');
    }
  }

  function requestNoteInput(requestId) {
    const noteKey = `request:${requestId}`;
    const inputId = `fipa-request-note-${requestId}`;
    return (
      <label className="fipa-admin-note" htmlFor={inputId}>
        <span>{t('fipaAdminLibrary.fields.decisionNote')}</span>
        <textarea
          id={inputId}
          maxLength={1000}
          value={notes[noteKey] || ''}
          disabled={Boolean(actionKey)}
          onChange={(event) => updateNote(noteKey, event.target.value)}
        />
      </label>
    );
  }

  function grantNoteInput(grantId) {
    const noteKey = `grant:${grantId}`;
    const inputId = `fipa-grant-note-${grantId}`;
    return (
      <label className="fipa-admin-note" htmlFor={inputId}>
        <span>{t('fipaAdminLibrary.fields.revokeNote')}</span>
        <textarea
          id={inputId}
          maxLength={1000}
          value={notes[noteKey] || ''}
          disabled={Boolean(actionKey)}
          onChange={(event) => updateNote(noteKey, event.target.value)}
        />
      </label>
    );
  }

  const statusLabel = (value) => t(`fipaAdminLibrary.statuses.${value}`);
  const venueText = (request) => {
    if (request.venue_not_listed) return t('fipaAdminLibrary.venue.notListed');
    const venueId = request.sede_id || request.declared_sede_id;
    return venueId
      ? t('fipaAdminLibrary.venue.identified', { id: venueId })
      : t('fipaAdminLibrary.venue.pending');
  };

  return (
    <main className="fipa-admin-library">
      <Link className="fipa-admin-library__back" to="/admin?tab=solicitudes">
        {t('fipaAdminLibrary.back')}
      </Link>

      <header className="fipa-admin-library__header">
        <p className="fipa-admin-library__eyebrow">{t('fipaAdminLibrary.eyebrow')}</p>
        <h1>{t('fipaAdminLibrary.title')}</h1>
        <p>{t('fipaAdminLibrary.intro')}</p>
      </header>

      <div className="fipa-admin-library__feedback" aria-live="polite">
        {error && <p className="fipa-admin-library__alert" role="alert">{error}</p>}
        {message && <p className="fipa-admin-library__success" role="status">{message}</p>}
      </div>

      <div className="fipa-admin-library__toolbar">
        <label htmlFor="fipa-request-status">
          <span>{t('fipaAdminLibrary.filterLabel')}</span>
          <select
            id="fipa-request-status"
            value={status}
            disabled={Boolean(actionKey)}
            onChange={(event) => {
              setStatus(event.target.value);
              setError('');
              setMessage('');
            }}
          >
            {REQUEST_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
            ))}
          </select>
        </label>
        <button
          className="fipa-admin-library__secondary"
          type="button"
          disabled={Boolean(actionKey) || loading}
          onClick={() => setReload((value) => value + 1)}
        >
          {t('fipaAdminLibrary.refresh')}
        </button>
      </div>

      {loading ? (
        <p className="fipa-admin-library__loading" role="status">{t('fipaAdminLibrary.loading')}</p>
      ) : (
        <div className="fipa-admin-library__columns">
          <section aria-labelledby="fipa-admin-requests-title">
            <div className="fipa-admin-library__section-heading">
              <div>
                <p>{t('fipaAdminLibrary.requests.eyebrow')}</p>
                <h2 id="fipa-admin-requests-title">{t('fipaAdminLibrary.requests.title')}</h2>
              </div>
              <span className="fipa-admin-library__count">{requests.length}</span>
            </div>

            {!requests.length && !error && (
              <div className="fipa-admin-library__empty">
                <strong>{t('fipaAdminLibrary.empty.requestsTitle')}</strong>
                <p>{t('fipaAdminLibrary.empty.requestsBody', { status: statusLabel(status).toLowerCase() })}</p>
              </div>
            )}

            {requests.map((request) => {
              const location = [request.country, request.city, request.address].filter(Boolean).join(' · ');
              return (
                <article className="fipa-admin-library__card" key={request.id}>
                  <div className="fipa-admin-library__card-title">
                    <div>
                      <h3>{request.club_name || t('fipaAdminLibrary.venue.declared')}</h3>
                      <p>{request.email_snapshot || t('fipaAdminLibrary.accountRegistered')}</p>
                    </div>
                    <span className={`fipa-admin-library__badge fipa-admin-library__badge--${request.status || status}`}>
                      {statusLabel(request.status || status)}
                    </span>
                  </div>

                  <dl className="fipa-admin-library__details">
                    <div>
                      <dt>{t('fipaAdminLibrary.fields.location')}</dt>
                      <dd>{location || t('fipaAdminLibrary.unknown')}</dd>
                    </div>
                    <div>
                      <dt>{t('fipaAdminLibrary.fields.venue')}</dt>
                      <dd>{venueText(request)}</dd>
                    </div>
                    <div>
                      <dt>{t('fipaAdminLibrary.fields.requestedAt')}</dt>
                      <dd>{formatAdminDate(request.requested_at, locale, t('fipaAdminLibrary.unknown'))}</dd>
                    </div>
                    {request.reviewed_at && (
                      <div>
                        <dt>{t('fipaAdminLibrary.fields.reviewedAt')}</dt>
                        <dd>{formatAdminDate(request.reviewed_at, locale, t('fipaAdminLibrary.unknown'))}</dd>
                      </div>
                    )}
                    {request.review_note && (
                      <div className="fipa-admin-library__detail-wide">
                        <dt>{t('fipaAdminLibrary.fields.reviewNote')}</dt>
                        <dd>{request.review_note}</dd>
                      </div>
                    )}
                  </dl>

                  {request.status === 'pending' && (
                    <div className="fipa-admin-library__decision">
                      {requestNoteInput(request.id)}
                      <p className="fipa-admin-library__hint">{t('fipaAdminLibrary.requests.approvalEffect')}</p>
                      <div className="fipa-admin-library__actions">
                        <button type="button" disabled={Boolean(actionKey)} onClick={() => act(request.id, 'approve')}>
                          {actionKey === `approve:${request.id}` ? t('fipaAdminLibrary.actions.working') : t('fipaAdminLibrary.actions.approve')}
                        </button>
                        <button className="fipa-admin-library__danger" type="button" disabled={Boolean(actionKey)} onClick={() => act(request.id, 'reject')}>
                          {actionKey === `reject:${request.id}` ? t('fipaAdminLibrary.actions.working') : t('fipaAdminLibrary.actions.reject')}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <section aria-labelledby="fipa-admin-grants-title">
            <div className="fipa-admin-library__section-heading">
              <div>
                <p>{t('fipaAdminLibrary.grants.eyebrow')}</p>
                <h2 id="fipa-admin-grants-title">{t('fipaAdminLibrary.grants.title')}</h2>
              </div>
              <span className="fipa-admin-library__count">{activeGrants.length}</span>
            </div>

            {!activeGrants.length && !error && (
              <div className="fipa-admin-library__empty">
                <strong>{t('fipaAdminLibrary.empty.grantsTitle')}</strong>
                <p>{t('fipaAdminLibrary.empty.grantsBody')}</p>
              </div>
            )}

            {activeGrants.map((grant) => (
              <article className="fipa-admin-library__card" key={grant.id}>
                <div className="fipa-admin-library__card-title">
                  <div>
                    <p className="fipa-admin-library__label">{t('fipaAdminLibrary.fields.account')}</p>
                    <h3>{resolveGrantAccount(grant, requests) || t('fipaAdminLibrary.unknown')}</h3>
                  </div>
                  <span className="fipa-admin-library__badge fipa-admin-library__badge--active">
                    {t('fipaAdminLibrary.statuses.active')}
                  </span>
                </div>

                <dl className="fipa-admin-library__details">
                  <div>
                    <dt>{t('fipaAdminLibrary.fields.grantedAt')}</dt>
                    <dd>{formatAdminDate(grant.granted_at, locale, t('fipaAdminLibrary.unknown'))}</dd>
                  </div>
                  <div>
                    <dt>{t('fipaAdminLibrary.fields.expiration')}</dt>
                    <dd>{grant.expires_at
                      ? formatAdminDate(grant.expires_at, locale, t('fipaAdminLibrary.unknown'))
                      : t('fipaAdminLibrary.grants.noExpiration')}</dd>
                  </div>
                </dl>

                <div className="fipa-admin-library__decision">
                  {grantNoteInput(grant.id)}
                  <button className="fipa-admin-library__danger" type="button" disabled={Boolean(actionKey)} onClick={() => act(grant.id, 'revoke')}>
                    {actionKey === `revoke:${grant.id}` ? t('fipaAdminLibrary.actions.working') : t('fipaAdminLibrary.actions.revoke')}
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
