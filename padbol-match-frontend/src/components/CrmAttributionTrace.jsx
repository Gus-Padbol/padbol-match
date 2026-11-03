import React from 'react';

const SOURCE_LABELS = {
  fb: 'Meta (Facebook)',
  facebook: 'Meta (Facebook)',
  meta: 'Meta',
  ig: 'Meta (Instagram)',
  instagram: 'Meta (Instagram)',
  google: 'Google Ads',
  googleads: 'Google Ads',
  adwords: 'Google Ads',
  organic: 'Búsqueda orgánica',
  seo: 'Búsqueda orgánica',
  direct: 'Acceso directo',
  directo: 'Acceso directo',
  newsletter: 'Email',
  email: 'Email',
  whatsapp: 'WhatsApp',
};

const PAID_MEDIA = new Set(['paid', 'cpc', 'ppc', 'paid_social', 'paid-social', 'ads', 'advertising']);

function field(fields, key) {
  const value = fields?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sourceFromFields(fields) {
  const raw = field(fields, 'utm_source');
  if (raw) {
    const key = raw.toLowerCase();
    const label = SOURCE_LABELS[key] || (/^[a-z0-9._-]{1,40}$/i.test(raw) ? raw : 'Origen no identificado');
    const medium = field(fields, 'utm_medium');
    return medium && PAID_MEDIA.has(medium.toLowerCase()) && !/pago$/i.test(label)
      ? `${label} · pago`
      : label;
  }
  if (field(fields, 'gclid') || field(fields, 'gbraid') || field(fields, 'wbraid')) return 'Google Ads';
  if (field(fields, 'fbclid')) return 'Meta';
  return null;
}

function sourceFromOrigin(conversation) {
  const origin = String(conversation?.origin || '').trim();
  if (origin.startsWith('web_form:')) return 'Formulario web';
  if (origin.startsWith('whatsapp:')) return 'WhatsApp';
  if (origin === 'institutional_email' || origin === 'support_email' || origin.startsWith('email:')) return 'Email';
  if (origin === 'manual' || origin.startsWith('manual')) return 'Registro manual';
  if (/^nextgen[.:_]/i.test(origin)) return 'Next Generation';
  if (conversation?.source_channel === 'whatsapp') return 'WhatsApp';
  if (conversation?.source_channel === 'email') return 'Email';
  return 'Origen no identificado';
}

export function resolveOrigin(conversation) {
  const fields = conversation?.qualification_data?.form_submission?.fields;
  const source = sourceFromFields(fields) || sourceFromOrigin(conversation);
  const campaign = field(fields, 'utm_id') || field(fields, 'utm_campaign') || field(fields, 'campaign_id');
  const dateValue = conversation?.received_at || conversation?.created_at || null;
  const date = dateValue && Number.isFinite(new Date(dateValue).getTime())
    ? new Date(dateValue).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Fecha no disponible';
  return { source, campaign, date };
}

export default function CrmAttributionTrace({ conversation }) {
  const { source, campaign, date } = resolveOrigin(conversation);
  return <section className="wa-panel" aria-label="Origen del interesado">
    <h3>Origen del interesado</h3>
    <dl>
      <div><dt>Fuente</dt><dd>{source}</dd></div>
      {campaign ? <div><dt>Campaña</dt><dd>{campaign}</dd></div> : null}
      <div><dt>Fecha</dt><dd>{date}</dd></div>
    </dl>
  </section>;
}
