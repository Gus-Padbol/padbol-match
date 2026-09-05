import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { supportTicketsApi } from '../utils/supportTicketsApi';
import './SupportTicketsPage.css';

const CATEGORIES = [
  ['reservas', 'Reservas'], ['pagos', 'Pagos'], ['torneos', 'Torneos'], ['cuenta', 'Cuenta'],
  ['configuracion', 'Configuración'], ['tecnico', 'Problema técnico'], ['otro', 'Otro'],
];
const STATUSES = [['abierto', 'Abierto'], ['en_revision', 'En revisión'], ['esperando_usuario', 'Esperando respuesta'], ['resuelto', 'Resuelto'], ['cerrado', 'Cerrado']];
const PRIORITIES = [['baja', 'Baja'], ['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];
const label = (items, value) => items.find(([key]) => key === value)?.[1] || value;
const when = (value) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';

export default function SupportTicketsPage({ adminMode = false }) {
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
    } catch (err) { setError(err.message || 'No se pudieron cargar los casos'); }
    finally { setLoading(false); }
  }, [token, isAdmin, filter, adminMode, roleLoading]);

  useEffect(() => { loadList(); }, [loadList]);
  const loadTicket = async (ticket) => {
    if (!token) return;
    setError('');
    try { setSelected(isAdmin ? await supportTicketsApi.getAdmin(token, ticket.id) : await supportTicketsApi.getMine(token, ticket.id)); }
    catch (err) { setError(err.message || 'No se pudo abrir el caso'); }
  };
  const openTicket = async (event) => {
    event.preventDefault(); if (!token) return;
    setSending(true); setError('');
    try {
      const ticket = await supportTicketsApi.create(token, form);
      setForm({ categoria: 'otro', asunto: '', mensaje: '' });
      await loadList(); await loadTicket(ticket);
    } catch (err) { setError(err.message || 'No se pudo abrir el caso'); }
    finally { setSending(false); }
  };
  const sendReply = async (event) => {
    event.preventDefault(); if (!selected || !reply.trim() || !token) return;
    setSending(true); setError('');
    try {
      if (isAdmin) await supportTicketsApi.replyAdmin(token, selected.id, { mensaje: reply, internal });
      else await supportTicketsApi.replyMine(token, selected.id, reply);
      setReply(''); setInternal(false); await loadList(); await loadTicket(selected);
    } catch (err) { setError(err.message || 'No se pudo enviar el mensaje'); }
    finally { setSending(false); }
  };
  const updateTicket = async (changes) => {
    if (!selected || !token) return;
    setSending(true); setError('');
    try { await supportTicketsApi.updateAdmin(token, selected.id, changes); await loadList(); await loadTicket(selected); }
    catch (err) { setError(err.message || 'No se pudo actualizar el ticket'); }
    finally { setSending(false); }
  };
  const title = isAdmin ? 'Bandeja de soporte' : 'Soporte humano';
  const intro = isAdmin ? 'Tomá cada caso, respondé con contexto y dejá el seguimiento ordenado.' : 'Abrí un caso y seguí la conversación con el equipo hasta resolverlo.';
  const canReply = selected && selected.estado !== 'cerrado';

  if (!session?.user) return <div className="support-page"><section className="support-page__empty"><h1>Soporte</h1><p>Ingresá a tu cuenta para abrir y seguir un caso.</p><Link to="/acceso">Ingresar</Link></section></div>;
  if (adminMode && !roleLoading && rol !== 'super_admin') return <div className="support-page"><section className="support-page__empty"><h1>Acceso restringido</h1><p>La bandeja de soporte es solo para Super Admin.</p></section></div>;

  return <main className="support-page"><header className="support-page__header"><div><p className="support-page__eyebrow">PADBOL MATCH · SOPORTE</p><h1>{title}</h1><p>{intro}</p></div><button type="button" className="support-page__back" onClick={() => navigate(isAdmin ? '/admin' : '/hub')}>Volver</button></header>
    {error ? <p className="support-page__error" role="alert">{error}</p> : null}
    <div className="support-page__layout">
      <aside className="support-page__list">
        {isAdmin ? <label className="support-page__filter">Estado<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos los estados</option>{STATUSES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label> : <form className="support-page__form" onSubmit={openTicket}><strong>Abrir un caso</strong><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATEGORIES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select><input required minLength="4" maxLength="160" value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })} placeholder="Asunto"/><textarea required value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} placeholder="Contanos qué necesitás" rows="4"/><button disabled={sending}>{sending ? 'Enviando…' : 'Abrir ticket'}</button></form>}
        <div className="support-page__tickets">{loading ? <p>Cargando casos…</p> : tickets.length ? tickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => loadTicket(ticket)} className={`support-ticket-row${selected?.id === ticket.id ? ' is-active' : ''}`}><span className="support-ticket-row__top"><b>#{ticket.id} · {ticket.asunto}</b><i className={`support-status support-status--${ticket.estado}`}>{label(STATUSES, ticket.estado)}</i></span><small>{label(CATEGORIES, ticket.categoria)} · {when(ticket.updated_at)}</small>{isAdmin ? <small>{ticket.requester_role === 'sede' ? 'Sede' : 'Jugador'} · {ticket.requester_email || 'Sin correo'}</small> : null}</button>) : <p>No hay tickets para mostrar.</p>}</div>
      </aside>
      <section className="support-page__detail">{selected ? <><div className="support-detail__head"><div><p className="support-page__eyebrow">#{selected.id} · {label(CATEGORIES, selected.categoria)}</p><h2>{selected.asunto}</h2><p>{selected.requester_role === 'sede' ? 'Consulta de sede' : 'Consulta de jugador'}{isAdmin && selected.requester_email ? ` · ${selected.requester_email}` : ''}</p></div><div className="support-detail__controls"><span className={`support-status support-status--${selected.estado}`}>{label(STATUSES, selected.estado)}</span>{isAdmin ? <><select aria-label="Estado" disabled={sending} value={selected.estado} onChange={(e) => updateTicket({ estado: e.target.value })}>{STATUSES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select><select aria-label="Prioridad" disabled={sending} value={selected.prioridad} onChange={(e) => updateTicket({ prioridad: e.target.value })}>{PRIORITIES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></> : null}</div></div>
        <div className="support-messages">{selected.messages?.map((message) => <article key={message.id} className={`support-message support-message--${message.author_role}${message.internal ? ' support-message--internal' : ''}`}><small>{message.author_role === 'soporte' ? (message.internal ? 'Nota interna de soporte' : 'Soporte Padbol Match') : message.author_role === 'sede' ? 'Sede' : 'Jugador'} · {when(message.created_at)}</small><p>{message.body}</p></article>)}</div>
        {canReply ? <form className="support-reply" onSubmit={sendReply}><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isAdmin ? 'Escribí una respuesta clara para el usuario' : 'Agregá información al caso'} rows="3" required/>{isAdmin ? <label><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)}/> Nota interna: no se muestra al usuario</label> : null}<button disabled={sending}>{sending ? 'Enviando…' : isAdmin ? 'Enviar respuesta' : 'Enviar mensaje'}</button></form> : <p className="support-page__closed">Este caso está cerrado.</p>}</> : <div className="support-page__empty"><h2>Seleccioná un ticket</h2><p>Vas a ver todo el historial y las acciones disponibles.</p></div>}</section>
    </div>
  </main>;
}
