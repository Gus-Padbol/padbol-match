import React, { useMemo, useState } from 'react';
import {
  CRM_STATUSES,
  consentLabel,
  contactNeedsReview,
  contactReviewReason,
  countCrmMessages,
  formatCrmDate,
  originLabel,
  phoneCountry,
  readSourceStatus,
  statusLabel,
  timelineColor,
  timelineLabel,
} from '../../utils/whatsappCrmLeads';
import './WhatsappCrm.css';

/**
 * Ficha del contacto: datos, identidad y procedencia, consentimiento, estado,
 * responsable, notas, seguimiento, formularios recibidos e historial.
 *
 * El historial respeta D9: un renglón por mensaje, con su `source_ref` y el
 * estado en origen (`pending` mientras no haya envío real).
 */

function Fact({ label, children }) {
  const vacio = children === undefined || children === null || children === '';
  return (
    <div className="crm-fact">
      <dt>{label}</dt>
      <dd>{vacio ? '—' : children}</dd>
    </div>
  );
}

export default function WhatsappCrmContactDetail({ data, busy, onAction }) {
  const [nota, setNota] = useState('');
  const [estado, setEstado] = useState('');
  const [consentimiento, setConsentimiento] = useState('');
  const [seguimiento, setSeguimiento] = useState('');
  const [resultadoLlamada, setResultadoLlamada] = useState('');
  const [responsable, setResponsable] = useState('');

  const contacto = data?.contact || {};
  const timeline = data?.timeline || [];
  const mensajes = useMemo(() => countCrmMessages({ timeline }), [timeline]);
  const needsReview = contactNeedsReview(contacto);

  const enviar = (kind, payload) => {
    if (typeof onAction === 'function') onAction(kind, payload);
  };

  return (
    <div className="crm-detail">
      <header className="crm-detail__head">
        <div>
          <h2 className="crm-detail__title">{contacto.name || contacto.phoneOriginal || contacto.identityKey || 'Sin nombre'}</h2>
          <p className="crm-detail__sub">
            {contacto.identityKey || '—'} · {contacto.phoneOriginal || contacto.phoneNormalized || '—'}
          </p>
        </div>
        <div className="crm-detail__pills">
          <span className={`crm-pill crm-pill--status-${contacto.status}`}>{statusLabel(contacto.status)}</span>
          {needsReview ? <span className="crm-pill crm-pill--review" data-crm-review="true">Requiere revisión manual</span> : null}
        </div>
      </header>

      {/* Datos, identidad y procedencia */}
      <section className="crm-detail__section">
        <h3 className="crm-panel__title">Datos e identidad</h3>
        <dl className="crm-detail__facts">
          <Fact label="Nombre">{contacto.name}</Fact>
          <Fact label="Identidad">{contacto.identityKey}</Fact>
          <Fact label="Teléfono">{contacto.phoneOriginal || contacto.phoneNormalized}</Fact>
          <Fact label="País del teléfono">{phoneCountry(contacto)}</Fact>
          <Fact label="Canales">{(contacto.origins || []).map(originLabel).join(' · ')}</Fact>
          <Fact label="Fuente">{contacto.source || '—'}</Fact>
          <Fact label="Región">{contacto.country}</Fact>
          <Fact label="Estado del lead">{statusLabel(contacto.status)}</Fact>
          <Fact label="Responsable">{contacto.ownerUserId}</Fact>
          <Fact label="Último contacto">{formatCrmDate(contacto.lastContactAt)}</Fact>
          <Fact label="Próximo seguimiento">
            {contacto.nextAction ? `${contacto.nextAction}${contacto.nextActionAt ? ` · ${formatCrmDate(contacto.nextActionAt)}` : ''}` : ''}
          </Fact>
          <Fact label="Creado">{formatCrmDate(contacto.createdAt)}</Fact>
        </dl>
        {needsReview ? (
          <p className="crm-state__hint">
            Motivo de la revisión:{' '}
            {contactReviewReason(contacto) === 'phone_not_conclusive'
              ? 'Teléfono no concluyente'
              : (contactReviewReason(contacto) || '—')}
          </p>
        ) : null}
      </section>

      {/* Consentimiento: estado vigente + histórico del timeline */}
      <section className="crm-detail__section">
        <h3 className="crm-panel__title">Consentimiento</h3>
        <div className="crm-consent">
          <span className={`crm-consent__badge crm-consent__badge--${contacto.consentStatus || 'unknown'}`}>
            {consentLabel(contacto.consentStatus)}
          </span>
          <span className="crm-detail__sub">
            {contacto.consent ? `Origen: ${originLabel(contacto.consent.origin)}` : 'Sin registro de origen'}
          </span>
        </div>
        <div className="crm-actions__row">
          <select className="crm-field__select" aria-label="Cambiar consentimiento" value={consentimiento} onChange={(e) => setConsentimiento(e.target.value)}>
            <option value="">Cambiar consentimiento…</option>
            <option value="granted">{consentLabel('granted')}</option>
            <option value="denied">{consentLabel('denied')}</option>
            <option value="revoked">{consentLabel('revoked')}</option>
          </select>
          <button
            type="button"
            className="crm-btn crm-btn--quiet"
            disabled={busy || !consentimiento}
            onClick={() => enviar('consentimiento', { status: consentimiento, origin: 'panel:manual' })}
          >
            Registrar
          </button>
        </div>
        <ul className="crm-timeline">
          {timeline.filter((row) => row.kind === 'consentimiento').map((row, i) => (
            <li key={`consent-${i}`} className="crm-timeline__item" style={{ '--crm-dot': timelineColor('consentimiento') }}>
              <span className="crm-timeline__kind">Consentimiento</span>
              <span className="crm-timeline__at">{formatCrmDate(row.at)}</span>
              <p className="crm-timeline__text">{row.detail}</p>
              {row.source_ref ? (
                <p className="crm-timeline__ref">
                  referencia {row.source_ref} · estado en origen: {readSourceStatus(row) || '—'}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Formularios recibidos */}
      <section className="crm-detail__section">
        <h3 className="crm-panel__title">Formularios recibidos</h3>
        {data?.forms?.length ? (
          <ul className="crm-forms">
            {data.forms.map((form, i) => (
              <li key={form.id || i} className="crm-form">
                <span className="crm-form__origin">{originLabel(form.origin)}</span>
                <span className="crm-form__at"> · {formatCrmDate(form.at || form.createdAt)}</span>
                <div className="crm-form__fields">
                  {Object.entries(form.fields || {}).map(([clave, valor]) => (
                    <span key={clave} className="crm-form__field">{clave}: {String(valor)}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-state__hint">Este contacto no tiene formularios recibidos.</p>
        )}
      </section>

      {/* Acciones */}
      <section className="crm-detail__section">
        <h3 className="crm-panel__title">Acciones</h3>
        <div className="crm-actions">
          <div className="crm-actions__group">
            <label htmlFor="crm-nota">Nota interna</label>
            <textarea id="crm-nota" className="crm-field__input" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
            <button type="button" className="crm-btn crm-btn--quiet" disabled={busy || !nota.trim()} onClick={() => { enviar('nota', { detail: nota }); setNota(''); }}>
              Guardar nota
            </button>
          </div>

          <div className="crm-actions__group">
            <label htmlFor="crm-estado">Estado del lead</label>
            <select id="crm-estado" className="crm-field__select" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Cambiar estado…</option>
              {CRM_STATUSES.map((valor) => (
                <option key={valor} value={valor}>{statusLabel(valor)}</option>
              ))}
            </select>
            <button type="button" className="crm-btn crm-btn--quiet" disabled={busy || !estado} onClick={() => { enviar('estado', { status: estado }); setEstado(''); }}>
              Actualizar estado
            </button>
          </div>

          <div className="crm-actions__group">
            <label htmlFor="crm-llamada">Resultado de llamada</label>
            <input id="crm-llamada" className="crm-field__input" value={resultadoLlamada} placeholder="Ej.: no atendió" onChange={(e) => setResultadoLlamada(e.target.value)} />
            <button type="button" className="crm-btn crm-btn--quiet" disabled={busy || !resultadoLlamada.trim()} onClick={() => { enviar('llamada', { result: resultadoLlamada }); setResultadoLlamada(''); }}>
              Registrar llamada
            </button>
          </div>

          <div className="crm-actions__group">
            <label htmlFor="crm-seguimiento">Próximo seguimiento</label>
            <input id="crm-seguimiento" className="crm-field__input" value={seguimiento} placeholder="Ej.: Reintentar el martes" onChange={(e) => setSeguimiento(e.target.value)} />
            <button type="button" className="crm-btn crm-btn--quiet" disabled={busy || !seguimiento.trim()} onClick={() => { enviar('seguimiento', { nextAction: seguimiento }); setSeguimiento(''); }}>
              Agendar seguimiento
            </button>
          </div>

          <div className="crm-actions__group">
            <label htmlFor="crm-responsable">Responsable</label>
            <input id="crm-responsable" className="crm-field__input" value={responsable} placeholder="ID del responsable" onChange={(e) => setResponsable(e.target.value)} />
            <button type="button" className="crm-btn crm-btn--quiet" disabled={busy || !responsable.trim()} onClick={() => { enviar('asignacion', { ownerUserId: responsable }); setResponsable(''); }}>
              Asignar
            </button>
          </div>

          <div className="crm-actions__group">
            <label>Revisión</label>
            <button type="button" className="crm-btn crm-btn--quiet" disabled={busy} onClick={() => enviar('revision', { needsReview: true })}>
              Marcar para revisión
            </button>
          </div>
        </div>
        <p className="crm-state__hint">
          Esta ficha sólo registra. No envía mensajes de WhatsApp ni inicia llamadas.
        </p>
      </section>

      {/* Historial / timeline */}
      <section className="crm-detail__section">
        <h3 className="crm-timeline__title">
          Historial de conversación · {mensajes.inbound + mensajes.outbound}
        </h3>
        {timeline.length === 0 ? (
          <p className="crm-state__hint">Todavía no hay eventos registrados para este contacto.</p>
        ) : (
          <ul className="crm-timeline">
            {timeline.map((row, i) => (
              <li key={row.id || `${row.kind}-${i}`} className="crm-timeline__item" style={{ '--crm-dot': timelineColor(row.kind) }}>
                <span className="crm-timeline__kind">{timelineLabel(row.kind)}</span>
                <span className="crm-timeline__at">{formatCrmDate(row.at)}</span>
                <p className="crm-timeline__text">{row.detail}</p>
                {row.source_ref ? (
                  <p className="crm-timeline__ref">
                    referencia {row.source_ref}
                    {row.source_status !== undefined ? ` · estado en origen: ${readSourceStatus(row) || '—'}` : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
