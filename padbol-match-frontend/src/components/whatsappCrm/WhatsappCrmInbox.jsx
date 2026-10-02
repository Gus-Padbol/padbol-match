import React, { useEffect, useMemo, useState } from 'react';
import WhatsappCrmContactDetail from './WhatsappCrmContactDetail';
import WhatsappCrmFilters from './WhatsappCrmFilters';
import useWhatsappCrmDataSource from '../../hooks/useWhatsappCrmDataSource';
import {
  buildInboxSummary,
  channelColor,
  channelLabel,
  contactNeedsReview,
  formatCrmDate,
  originColor,
  originLabel,
  statusLabel,
} from '../../utils/whatsappCrmLeads';
import './WhatsappCrm.css';

/**
 * Bandeja unificada del CRM de WhatsApp.
 *
 * Estructura, textos y atributos `data-crm-*` tomados del DOM aprobado:
 * encabezado, procedencia de los datos, aviso de no envío, alcance, resumen de
 * cinco contadores, filtros, lista de contactos y ficha al costado.
 */

function SourceBanner({ variant, badge, text }) {
  return (
    <p className={`crm-source crm-source--${variant}`} data-crm-data-source={variant === 'connected' ? 'conectado' : variant}>
      <span className="crm-source__badge">{badge}</span>
      <span className="crm-source__text">{text}</span>
    </p>
  );
}

function ContactRow({ contact, active, onSelect }) {
  const needsReview = contactNeedsReview(contact);
  return (
    <li>
      <button
        type="button"
        className={`crm-row${active ? ' is-active' : ''}`}
        aria-label={`Abrir ficha de ${contact.name || contact.phoneNormalized || contact.identityKey}`}
        data-crm-contact-id={contact.id}
        data-crm-channel={contact.channel || (contact.origins || [])[0] || 'otro'}
        data-crm-origins={(contact.origins || []).join(',')}
        data-crm-status={contact.status}
        onClick={() => onSelect(contact.id)}
      >
        <span className="crm-row__identity">
          <span className="crm-row__name">{contact.name || contact.phoneOriginal || contact.identityKey || 'Sin nombre'}</span>
          <span className="crm-row__sub">{contact.phoneOriginal || contact.phoneNormalized || contact.identityKey || '—'}</span>
        </span>

        <span className="crm-row__meta crm-row__status">
          <span className={`crm-pill crm-pill--status-${contact.status}`}>{statusLabel(contact.status)}</span>
        </span>

        <span className="crm-row__tags">
          <span
            className={`crm-pill crm-pill--channel-${contact.channel || (contact.origins || [])[0] || 'otro'}`}
            style={{ borderColor: channelColor(contact.channel) }}
          >
            {channelLabel(contact.channel)}
          </span>
          {(contact.origins || []).map((origin) => (
            <span key={origin} className="crm-pill" style={{ borderColor: originColor(origin) }}>
              {originLabel(origin)}
            </span>
          ))}
          <span className="crm-pill">{contact.country || 'Sin sede asignada'}</span>
          {needsReview ? (
            <span className="crm-pill crm-pill--review" data-crm-review="true">Requiere revisión manual</span>
          ) : null}
        </span>

        <span className="crm-row__meta-lines">
          <span className="crm-row__meta-line">Responsable: {contact.ownerUserId || 'Sin responsable'}</span>
          <span className="crm-row__meta-line">
            Próximo seguimiento: {contact.nextAction
              ? `${contact.nextAction}${contact.nextActionAt ? ` · ${formatCrmDate(contact.nextActionAt)}` : ''}`
              : 'Sin seguimiento agendado'}
          </span>
          <span className="crm-row__meta-line">Último contacto: {formatCrmDate(contact.lastContactAt)}</span>
        </span>
      </button>
    </li>
  );
}

export default function WhatsappCrmInbox({ accessToken, preview = false, isSuperAdmin = false }) {
  const crm = useWhatsappCrmDataSource(accessToken);
  const [filtros, setFiltros] = useState({ q: '', status: '', origin: '', region: '', ownerUserId: '', consentStatus: '' });

  useEffect(() => {
    const id = setTimeout(() => { crm.load(filtros); }, 180);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filtros)]);

  const resumen = useMemo(() => buildInboxSummary(crm.contacts), [crm.contacts]);
  const regiones = useMemo(
    () => [...new Set(crm.contacts.map((c) => c.country).filter(Boolean))].sort(),
    [crm.contacts],
  );
  const responsables = useMemo(() => {
    const ids = [...new Set(crm.contacts.map((c) => c.ownerUserId).filter(Boolean))];
    return ids.map((id) => ({ id, label: id }));
  }, [crm.contacts]);

  const sinSesion = crm.errorStatus === 401;
  const sinPermiso = crm.errorStatus === 403;

  return (
    <div className="crm-page">
      <div className="crm-inbox" data-crm-dispatch-allowed="false" data-crm-data-source={crm.error ? 'error' : 'conectado'}>
        <header className="crm-inbox__header">
          <h1 className="crm-inbox__title">CRM de WhatsApp · Bandeja unificada</h1>
          <p className="crm-inbox__subtitle">
            Contactos que entran por el WhatsApp empresarial y por el formulario web, en una sola ficha.
          </p>

          {preview ? (
            <SourceBanner variant="pending" badge="VISTA PREVIA DE QA" text="El origen de los datos se indica abajo." />
          ) : null}
          {crm.error ? (
            <SourceBanner variant="error" badge="SIN CONEXIÓN CON EL CRM" text={crm.error} />
          ) : (
            <SourceBanner variant="connected" badge="CONECTADO AL BACKEND DEL CRM" text="La bandeja lee y escribe contra la API del CRM." />
          )}

          <p className="crm-inbox__notice" data-crm-no-dispatch="true">
            Esta bandeja sólo registra. No envía mensajes ni inicia llamadas.
          </p>

          {isSuperAdmin ? (
            <p className="crm-inbox__scope">Vista de superadministrador: todas las sedes y todos los responsables.</p>
          ) : (
            <p className="crm-inbox__scope">Vista de responsable: sólo los contactos asignados a tu alcance.</p>
          )}
          {preview ? <p className="crm-inbox__scope">Vista previa de QA sin sesión. El origen de los datos se indica arriba.</p> : null}

          <ul className="crm-inbox__summary">
            {resumen.map((item) => (
              <li key={item.key} className={`crm-inbox__summary-item${item.alert && item.value > 0 ? ' crm-inbox__summary-item--alert' : ''}`}>
                <span className="crm-inbox__summary-value">{item.value}</span>
                <span className="crm-inbox__summary-label">{item.label}</span>
              </li>
            ))}
          </ul>
        </header>

        <WhatsappCrmFilters value={filtros} onChange={setFiltros} count={crm.contacts.length} regions={regiones} owners={responsables} />

        <div className="crm-inbox__body">
          <section className="crm-panel" aria-label="Bandeja de contactos">
            <h2 className="crm-panel__title">Bandeja de contactos</h2>

            {crm.loading && !crm.contacts.length ? (
              <p className="crm-loading" role="status">Cargando contactos…</p>
            ) : null}

            {!crm.loading && crm.error && !crm.contacts.length ? (
              <div className="crm-state" role="alert">
                <p className="crm-state__text">
                  {sinSesion ? 'Necesitás iniciar sesión para ver el CRM.'
                    : sinPermiso ? 'Tu cuenta no tiene permiso para ver el CRM.'
                      : 'No se pudo cargar la bandeja.'}
                </p>
                <p className="crm-state__hint">{crm.error}</p>
              </div>
            ) : null}

            {!crm.error && !crm.loading && crm.contacts.length === 0 ? (
              <div className="crm-state">
                <p className="crm-state__text">No hay contactos que coincidan con los filtros.</p>
                <p className="crm-state__hint">Probá limpiar los filtros o esperá nuevas consultas.</p>
              </div>
            ) : null}

            {crm.contacts.length > 0 ? (
              <ul className="crm-list">
                {crm.contacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    active={crm.detail?.contact?.id === contact.id}
                    onSelect={crm.select}
                  />
                ))}
              </ul>
            ) : null}
          </section>

          <section className="crm-panel" aria-label="Ficha del contacto">
            {crm.detail ? (
              <WhatsappCrmContactDetail
                data={crm.detail}
                busy={crm.loading}
                onAction={(kind, payload) => crm.act(crm.detail.contact.id, kind, payload)}
              />
            ) : (
              <p className="crm-state__text" data-crm-state="no-detail">
                Elegí un contacto de la lista para ver su ficha, su historial y sus seguimientos
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
