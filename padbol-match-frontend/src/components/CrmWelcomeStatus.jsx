import React from 'react';
import './CrmWelcomeStatus.css';

const LABELS = {
  not_recorded: 'Bienvenida sin envío registrado',
  processing: 'Enviando bienvenida',
  sent: 'Bienvenida enviada',
  needs_review: 'Revisar envío de bienvenida',
  unavailable: 'Estado de envío no disponible',
};

function sentDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Only presents the private CRM's authoritative projection; never infers a send. */
export default function CrmWelcomeStatus({ welcome, compact = false }) {
  if (!welcome || typeof welcome !== 'object' || !Object.prototype.hasOwnProperty.call(LABELS, welcome.status)) return null;
  const date = welcome.status === 'sent' ? sentDate(welcome.sent_at) : null;
  const response = welcome.status === 'sent'
    ? welcome.response_state === 'reply_received' ? 'Respuesta recibida'
      : welcome.response_state === 'no_reply_registered' ? 'Esperando respuesta' : null
    : null;
  return <div className={`crm-welcome-status crm-welcome-status--${welcome.status}${compact ? ' crm-welcome-status--compact' : ''}`} aria-label="Estado de la bienvenida">
    <span className="crm-welcome-status__send">
      {welcome.status === 'sent' ? <span aria-hidden="true">✓ </span> : null}
      <strong>{LABELS[welcome.status]}</strong>
      {date ? <time dateTime={date.toISOString()} title={date.toLocaleString('es')}>{date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</time> : null}
    </span>
    {response ? <span className="crm-welcome-status__response">{response}</span> : null}
  </div>;
}
