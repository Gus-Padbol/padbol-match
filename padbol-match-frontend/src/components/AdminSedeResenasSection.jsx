import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import './ResenasSede.css';

const REPLY_MAX_CHARS = 1000;

function resenaDisplayName(r) {
  const nombrePartes = [r?.autor?.nombre, r?.autor?.apellido].filter(Boolean).join(' ').trim();
  return String(r?.display_name || nombrePartes || r?.nombre || '').trim() || 'Jugador';
}

function formatFecha(iso, locale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function EstrellasLectura({ value }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className="reseñas-sede__stars" aria-label={`${v} de 5 estrellas`}>
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

/**
 * Panel admin club: listado de reseñas recibidas y respuesta del club.
 */
export default function AdminSedeResenasSection({ apiBaseUrl, accessToken, sedeId }) {
  const { t, i18n } = useTranslation();
  const sid = useMemo(() => parseInt(String(sedeId), 10), [sedeId]);
  const dateLocale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyOpenId, setReplyOpenId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');

  const loadRows = useCallback(async () => {
    if (!Number.isFinite(sid) || !accessToken) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${apiBaseUrl}/api/sedes/${sid}/resenas?limit=100&offset=0`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || t('admin.resenas.loadError'));
      setRows(Array.isArray(body.resenas) ? body.resenas : []);
    } catch (e) {
      setError(e.message || t('admin.resenas.loadError'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, sid, t]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openReply = (row) => {
    setReplyOpenId(row.id);
    setReplyText(String(row.respuesta_admin || '').trim());
    setReplyMsg('');
  };

  const cancelReply = () => {
    setReplyOpenId(null);
    setReplyText('');
    setReplyMsg('');
  };

  const submitReply = async (resenaId) => {
    const text = String(replyText || '').trim();
    if (!text) {
      setReplyMsg(t('admin.resenas.replyRequired'));
      return;
    }
    setReplySaving(true);
    setReplyMsg('');
    try {
      const r = await fetch(`${apiBaseUrl}/api/admin/resenas/${encodeURIComponent(resenaId)}/respuesta`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ respuesta: text }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || t('admin.resenas.replyError'));
      setReplyOpenId(null);
      setReplyText('');
      await loadRows();
    } catch (e) {
      setReplyMsg(e.message || t('admin.resenas.replyError'));
    } finally {
      setReplySaving(false);
    }
  };

  if (!Number.isFinite(sid)) return null;

  return (
    <div className="reseñas-sede admin-sede-resenas">
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {t('admin.resenas.intro')}
      </p>

      {loading ? (
        <p className="reseñas-sede__loading">{t('admin.resenas.loading')}</p>
      ) : error ? (
        <p className="reseñas-sede__form-msg reseñas-sede__form-msg--err">{error}</p>
      ) : rows.length === 0 ? (
        <p className="reseñas-sede__empty">{t('admin.resenas.empty')}</p>
      ) : (
        <div className="reseñas-sede__list">
          {rows.map((row) => {
            const displayName = resenaDisplayName(row);
            const hasReply = Boolean(String(row.respuesta_admin || '').trim());
            const isOpen = replyOpenId === row.id;
            return (
              <article key={row.id} className="reseñas-sede__item">
                <div className="reseñas-sede__body" style={{ width: '100%' }}>
                  <div className="reseñas-sede__head">
                    <span className="reseñas-sede__name">{displayName}</span>
                    <EstrellasLectura value={row.estrellas} />
                    <span className="reseñas-sede__date">{formatFecha(row.created_at, dateLocale)}</span>
                  </div>
                  {String(row.comentario || '').trim() ? (
                    <p className="reseñas-sede__comment">{row.comentario}</p>
                  ) : (
                    <p className="reseñas-sede__comment" style={{ fontStyle: 'italic' }}>
                      {t('admin.resenas.noComment')}
                    </p>
                  )}
                  {hasReply ? (
                    <div className="reseñas-sede__reply">
                      <div className="reseñas-sede__reply-label">{t('resenas.clubReply')}</div>
                      <p className="reseñas-sede__reply-text">{row.respuesta_admin}</p>
                      <button
                        type="button"
                        className="reseñas-sede__login-link"
                        style={{ marginTop: 8, fontSize: 12 }}
                        onClick={() => openReply(row)}
                      >
                        {t('admin.resenas.editReply')}
                      </button>
                    </div>
                  ) : null}
                  {isOpen ? (
                    <div style={{ marginTop: 12 }}>
                      <textarea
                        className="reseñas-sede__textarea"
                        value={replyText}
                        maxLength={REPLY_MAX_CHARS}
                        disabled={replySaving}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={3}
                        placeholder={t('admin.resenas.replyPlaceholder')}
                      />
                      <div className="reseñas-sede__form-footer">
                        <span className="reseñas-sede__char-count">
                          {replyText.length}/{REPLY_MAX_CHARS}
                        </span>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="reseñas-sede__submit" disabled={replySaving} onClick={() => submitReply(row.id)}>
                            {replySaving ? t('admin.resenas.savingReply') : t('admin.resenas.saveReply')}
                          </button>
                          <button
                            type="button"
                            className="reseñas-sede__login-link"
                            disabled={replySaving}
                            onClick={cancelReply}
                          >
                            {t('general.cancel')}
                          </button>
                        </div>
                      </div>
                      {replyMsg ? (
                        <p className="reseñas-sede__form-msg reseñas-sede__form-msg--err">{replyMsg}</p>
                      ) : null}
                    </div>
                  ) : !hasReply ? (
                    <button
                      type="button"
                      className="reseñas-sede__submit"
                      style={{ marginTop: 10 }}
                      onClick={() => openReply(row)}
                    >
                      {t('admin.resenas.respond')}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
