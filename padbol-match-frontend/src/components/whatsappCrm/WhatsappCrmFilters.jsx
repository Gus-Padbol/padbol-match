import React from 'react';
import { CRM_CONSENT_STATUSES, CRM_ORIGIN_FILTERS, CRM_STATUSES, consentLabel, statusLabel } from '../../utils/whatsappCrmLeads';

/**
 * Filtros superiores del CRM (estructura y etiquetas del DOM aprobado):
 * Buscar contacto · Estado del lead · Origen · Región · Responsable ·
 * Consentimiento, con el contador de resultados y «Limpiar filtros».
 */
export default function WhatsappCrmFilters({ value = {}, onChange, count, regions = [], owners = [] }) {
  const set = (clave) => (evento) => onChange({ ...value, [clave]: evento.target.value });
  const activos = Object.values(value).filter((v) => v !== '' && v !== undefined && v !== null).length;

  return (
    <section className="crm-filters" aria-label="Filtros de la bandeja">
      <h2 className="crm-panel__title">Filtros</h2>

      <div className="crm-filters__row">
        <div className="crm-field">
          <label className="crm-field__label" htmlFor="crm-f-q">Buscar contacto</label>
          <input
            id="crm-f-q"
            className="crm-field__input"
            type="search"
            placeholder="Nombre, teléfono o email…"
            value={value.q || ''}
            onChange={set('q')}
          />
        </div>

        <div className="crm-field">
          <label className="crm-field__label" htmlFor="crm-f-status">Estado del lead</label>
          <select id="crm-f-status" className="crm-field__select" value={value.status || ''} onChange={set('status')}>
            <option value="">Todos</option>
            {CRM_STATUSES.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
        </div>

        <div className="crm-field">
          <label className="crm-field__label" htmlFor="crm-f-origin">Origen</label>
          <select id="crm-f-origin" className="crm-field__select" value={value.origin || ''} onChange={set('origin')}>
            <option value="">Todos</option>
            {CRM_ORIGIN_FILTERS.map((origen) => (
              <option key={origen.value} value={origen.value}>{origen.label}</option>
            ))}
          </select>
        </div>

        <div className="crm-field">
          <label className="crm-field__label" htmlFor="crm-f-region">Región</label>
          <select id="crm-f-region" className="crm-field__select" value={value.region || ''} onChange={set('region')}>
            <option value="">Todas</option>
            {regions.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>

        <div className="crm-field">
          <label className="crm-field__label" htmlFor="crm-f-owner">Responsable</label>
          <select id="crm-f-owner" className="crm-field__select" value={value.ownerUserId || ''} onChange={set('ownerUserId')}>
            <option value="">Todos</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.label}</option>
            ))}
          </select>
        </div>

        <div className="crm-field">
          <label className="crm-field__label" htmlFor="crm-f-consent">Consentimiento</label>
          <select id="crm-f-consent" className="crm-field__select" value={value.consentStatus || ''} onChange={set('consentStatus')}>
            <option value="">Todos</option>
            {/* Orden del DOM aprobado: Denegado · Revocado · Sin registrar */}
            <option value="denied">{consentLabel('denied')}</option>
            <option value="revoked">{consentLabel('revoked')}</option>
            <option value="granted">{consentLabel('granted')}</option>
            <option value="unknown">{consentLabel('unknown')}</option>
          </select>
        </div>
      </div>

      <div className="crm-filters__actions">
        <p className="crm-filters__count" data-crm-results-count={count}>
          {count} {count === 1 ? 'contacto' : 'contactos'}
          {activos ? ` · ${activos} ${activos === 1 ? 'filtro activo' : 'filtros activos'}` : ''}
        </p>
        <button
          type="button"
          className="crm-btn crm-btn--tertiary"
          onClick={() => onChange({ q: '', status: '', origin: '', region: '', ownerUserId: '', consentStatus: '' })}
          disabled={!activos && !(value.q || '').length}
        >
          Limpiar filtros
        </button>
      </div>
    </section>
  );
}
