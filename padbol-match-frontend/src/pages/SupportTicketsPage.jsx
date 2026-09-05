import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { supportTicketsApi } from '../utils/supportTicketsApi';
import './SupportTicketsPage.css';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const CATEGORIES = ['reservas', 'pagos', 'torneos', 'cuenta', 'configuracion', 'tecnico', 'otro'];
const STATUSES = ['abierto', 'en_revision', 'esperando_usuario', 'resuelto', 'cerrado'];
const PRIORITIES = ['baja', 'normal', 'alta', 'urgente'];
const label = (scope, value, t) => t(`support.${scope}.${value}`);
const when = (value, locale) => value ? new Intl.DateTimeFormat(locale || 'en', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';

export default function SupportTicketsPage({ adminMode = false }) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.resolvedLanguage || i18n.language || 'en';
  const navigate = useNavigate();
  const { session } = useAuth();
  const { rol, loading: roleLoading } = useUserRole(session?.user || null);
  const isAdmin = adminMode || rol === 'super_admin';
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ categoria: 'otro', asunto: '', mensaje: '' });
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const token = session?.access_token;
  const loadList = useCallback(async () => {
    if (!token || (adminMode && roleLoading)) return;
    setLoading(true); setError('');
    try {
      const rows = isAdmin ? await supportTicketsApi.listAdmin(token, filter) : await supportTicketsApi.listMine(token);
      setTickets(rows);
    } catch (err) { setError(err.message || t('support.errors.load')); }
    finally { setLoading(false); }
  }, [token, isAdmin, filter, adminMode, roleLoading, t]);

  useEffect(() => { loadList(); }, [loadList]);
  const loadTicket = async (ticket) => {
    if (!token) return;
    setError('');
    try { setSelected(isAdmin ? await supportTicketsApi.getAdmin(token, ticket.id) : await supportTicketsApi.getMine(token, ticket.id)); }
    catch (err) { setError(err.message || t('support.errors.open')); }
  };
  const openTicket = async (event) => {
    event.preventDefault(); if (!token) return;
    setSending(true); setError('');
    try {
      const ticket = await supportTicketsApi.create(token, form);
      setForm({ categoria: 'otro', asunto: '', mensaje: '' });
      await loadList(); await loadTicket(ticket);
    } catch (err) { setError(err.message || t('support.errors.open')); }
    finally { setSending(false); }
  };
  const sendReply = async (event) => {
    event.preventDefault(); if (!selected || !reply.trim() || !token) return;
    setSending(true); setError('');
    try {
      if (isAdmin) await supportTicketsApi.replyAdmin(token, selected.id, { mensaje: reply, internal });
      else await supportTicketsApi.replyMine(token, selected.id, reply);
      setReply(''); setInternal(false); await loadList(); await loadTicket(selected);
    } catch (err) { setError(err.message || t('support.errors.send')); }
    finally { setSending(false); }
  };
  const updateTicket = async (changes) => {
    if (!selected || !token) return;
    setSending(true); setError('');
    try { await supportTicketsApi.updateAdmin(token, selected.id, changes); await loadList(); await loadTicket(selected); }
    catch (err) { setError(err.message || t('support.errors.update')); }
    finally { setSending(false); }
  };
  const title = isAdmin ? t('support.adminTitle') : t('support.userTitle');
  const intro = isAdmin ? t('support.adminIntro') : t('support.userIntro');
  const canReply = selected && selected.estado !== 'cerrado';

  if (!session?.user) return <div className="support-page"><section className="support-page__empty"><h1>{t('support.title')}</h1><p>{t('support.signInRequired')}</p><Link to="/acceso">{t('auth.login')}</Link></section></div>;
  if (adminMode && !roleLoading && rol !== 'super_admin') return <div className="support-page"><section className="support-page__empty"><h1>{t('support.restrictedTitle')}</h1><p>{t('support.restrictedBody')}</p></section></div>;

  return <main className="support-page"><header className="support-page__header"><div><p className="support-page__eyebrow">PADBOL MATCH · {t('support.eyebrow')}</p><h1>{title}</h1><p>{intro}</p></div><button type="button" className="support-page__back" onClick={() => navigate(isAdmin ? '/admin' : '/hub')}>{t('general.back')}</button></header>
    {error ? <p className="support-page__error" role="alert">{error}</p> : null}
    <div className="support-page__layout">
      <aside className="support-page__list">
        {isAdmin ? <label className="support-page__filter">{t('support.statusLabel')}<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">{t('support.allStatuses')}</option>{STATUSES.map((key) => <option key={key} value={key}>{label('status', key, t)}</option>)}</select></label> : <form className="support-page__form" onSubmit={openTicket}><strong>{t('support.openCase')}</strong><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATEGORIES.map((key) => <option key={key} value={key}>{label('category', key, t)}</option>)}</select><input required minLength="4" maxLength="160" value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })} placeholder={t('support.subject')}/><textarea required value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} placeholder={t('support.tellUs')} rows="4"/><button disabled={sending}>{sending ? t('support.sending') : t('support.openTicket')}</button></form>}
        <div className="support-page__tickets">{loading ? <p>{t('support.loadingCases')}</p> : tickets.length ? tickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => loadTicket(ticket)} className={`support-ticket-row${selected?.id === ticket.id ? ' is-active' : ''}`}><span className="support-ticket-row__top"><b>#{ticket.id} · {ticket.asunto}</b><i className={`support-status support-status--${ticket.estado}`}>{label('status', ticket.estado, t)}</i></span><small>{label('category', ticket.categoria, t)} · {when(ticket.updated_at, dateLocale)}</small>{isAdmin ? <small>{ticket.requester_role === 'sede' ? t('support.venue') : t('support.player')} · {ticket.requester_email || t('support.noEmail')}</small> : null}</button>) : <p>{t('support.noTickets')}</p>}</div>
      </aside>
      <section className="support-page__detail">{selected ? <><div className="support-detail__head"><div><p className="support-page__eyebrow">#{selected.id} · {label('category', selected.categoria, t)}</p><h2>{selected.asunto}</h2><p>{selected.requester_role === 'sede' ? t('support.venueQuery') : t('support.playerQuery')}{isAdmin && selected.requester_email ? ` · ${selected.requester_email}` : ''}</p></div><div className="support-detail__controls"><span className={`support-status support-status--${selected.estado}`}>{label('status', selected.estado, t)}</span>{isAdmin ? <><select aria-label={t('support.statusLabel')} disabled={sending} value={selected.estado} onChange={(e) => updateTicket({ estado: e.target.value })}>{STATUSES.map((key) => <option key={key} value={key}>{label('status', key, t)}</option>)}</select><select aria-label={t('support.priorityLabel')} disabled={sending} value={selected.prioridad} onChange={(e) => updateTicket({ prioridad: e.target.value })}>{PRIORITIES.map((key) => <option key={key} value={key}>{label('priority', key, t)}</option>)}</select></> : null}</div></div>
        <div className="support-messages">{selected.messages?.map((message) => <article key={message.id} className={`support-message support-message--${message.author_role}${message.internal ? ' support-message--internal' : ''}`}><small>{message.author_role === 'soporte' ? (message.internal ? t('support.internalSupportNote') : t('support.padbolSupport')) : message.author_role === 'sede' ? t('support.venue') : t('support.player')} · {when(message.created_at, dateLocale)}</small><p>{message.body}</p></article>)}</div>
        {canReply ? <form className="support-reply" onSubmit={sendReply}><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isAdmin ? t('support.adminReplyPlaceholder') : t('support.userReplyPlaceholder')} rows="3" required/>{isAdmin ? <label><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)}/> {t('support.internalNote')}</label> : null}<button disabled={sending}>{sending ? t('support.sending') : isAdmin ? t('support.sendReply') : t('support.sendMessage')}</button></form> : <p className="support-page__closed">{t('support.closedCase')}</p>}</> : <div className="support-page__empty"><h2>{t('support.selectTicket')}</h2><p>{t('support.historyHint')}</p></div>}</section>
    </div>
  </main>;
}
