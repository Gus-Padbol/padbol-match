/**
 * PadCoins — campañas activas visibles al jugador (frontend web).
 *
 * Backend pendiente: no existe endpoint público/jugador en padbol-backend (commit campañas admin).
 * Propuesta: GET /api/padcoins/sedes/:sedeId/active-campaign
 *
 * Este módulo prepara parseo, textos de UI y fetch seguro (retorna null si el endpoint no existe).
 */

export const PADCOINS_PLAYER_ACTIVE_CAMPAIGN_ENDPOINT = '/api/padcoins/sedes/:sedeId/active-campaign';

const CAMPAIGN_TYPES = {
  MULTIPLIER: 'multiplier',
  PERCENTAGE_OVERRIDE: 'percentage_override',
  FIXED_PADCOINS: 'fixed_padcoins',
  BENEFIT_EQUIVALENT: 'benefit_equivalent',
};

function normalizeCampaignType(type) {
  return String(type || '').trim().toLowerCase();
}

/**
 * @param {unknown} data Respuesta API jugador
 * @returns {object|null}
 */
export function parsePlayerActiveCampaign(data) {
  const raw = data?.campaign || data?.active_campaign || data?.data || data;
  if (!raw || typeof raw !== 'object') return null;
  if (raw.active === false || raw.has_active_campaign === false) return null;

  const type = normalizeCampaignType(raw.campaign_type);
  if (!type) return null;

  return {
    id: raw.id ?? null,
    sede_id: raw.sede_id != null ? Number(raw.sede_id) : null,
    name: raw.name || '',
    description: raw.description || '',
    campaign_type: type,
    message_title: raw.message_title || '',
    message_body: raw.message_body || '',
    multiplier: raw.multiplier != null ? Number(raw.multiplier) : null,
    loyalty_percentage_override: raw.loyalty_percentage_override != null
      ? Number(raw.loyalty_percentage_override)
      : null,
    fixed_padcoins: raw.fixed_padcoins != null ? Number(raw.fixed_padcoins) : null,
    benefit_id: raw.benefit_id ?? null,
    benefit_name: raw.benefit_name || raw.benefit?.nombre || '',
    start_at: raw.start_at || null,
    end_at: raw.end_at || null,
    display_label: raw.display_label || '',
    display_short_label: raw.display_short_label || '',
    high_impact: raw.high_impact === true,
  };
}

function formatMultiplierLabel(multiplier) {
  const m = Number(multiplier);
  if (!Number.isFinite(m) || m <= 0) return '';
  if (m === 1) return '';
  if (Number.isInteger(m)) {
    if (m === 2) return 'Duplica PadCoins';
    if (m === 3) return 'Triplica PadCoins';
    return `Multiplica PadCoins x${m}`;
  }
  return `Multiplica PadCoins x${String(m).replace('.', ',')}`;
}

/**
 * Etiqueta corta para horarios/canchas/reserva.
 * @param {ReturnType<typeof parsePlayerActiveCampaign>} campaign
 */
export function getPlayerCampaignSlotLabel(campaign) {
  if (!campaign) return '';
  if (campaign.display_short_label) return campaign.display_short_label;

  const type = normalizeCampaignType(campaign.campaign_type);
  if (type === CAMPAIGN_TYPES.MULTIPLIER) {
    const label = formatMultiplierLabel(campaign.multiplier);
    return label || 'Campaña activa';
  }
  if (type === CAMPAIGN_TYPES.FIXED_PADCOINS && Number.isFinite(campaign.fixed_padcoins)) {
    return `+ ${campaign.fixed_padcoins} PadCoins`;
  }
  if (type === CAMPAIGN_TYPES.PERCENTAGE_OVERRIDE) {
    return '+ PadCoins extra';
  }
  if (type === CAMPAIGN_TYPES.BENEFIT_EQUIVALENT) {
    return 'Campaña activa';
  }
  return 'Campaña activa';
}

/**
 * Título principal para banner (prioriza message_title del admin).
 */
export function getPlayerCampaignBannerTitle(campaign) {
  if (!campaign) return '';
  const custom = String(campaign.message_title || '').trim();
  if (custom) return custom;
  return 'Campaña PadCoins activa';
}

/**
 * Texto de banner en sede / reserva.
 */
export function getPlayerCampaignBannerBody(campaign) {
  if (!campaign) return '';
  const custom = String(campaign.message_body || '').trim();
  if (custom) return custom;

  const type = normalizeCampaignType(campaign.campaign_type);
  if (type === CAMPAIGN_TYPES.MULTIPLIER) {
    const label = formatMultiplierLabel(campaign.multiplier);
    if (label) return `${label} por tiempo limitado en esta sede.`;
  }
  if (type === CAMPAIGN_TYPES.FIXED_PADCOINS && Number.isFinite(campaign.fixed_padcoins)) {
    return `Reserva hoy y suma ${campaign.fixed_padcoins} PadCoins extra.`;
  }
  if (type === CAMPAIGN_TYPES.PERCENTAGE_OVERRIDE) {
    return 'Esta sede tiene una campaña especial por tiempo limitado.';
  }
  if (type === CAMPAIGN_TYPES.BENEFIT_EQUIVALENT) {
    return 'Confirma tu reserva y suma PadCoins extra para canjear beneficios.';
  }
  return 'Esta sede tiene una campaña especial por tiempo limitado.';
}

export function getPlayerCampaignConfirmMessage() {
  return 'Al confirmar esta reserva puedes sumar PadCoins extra por la campaña activa de esta sede.';
}

export function getPlayerCampaignSuccessMessage() {
  return 'Reserva confirmada. Si cumple las condiciones de la campaña, los PadCoins extra se acreditarán automáticamente.';
}

/**
 * Consulta campaña activa para una sede (jugador).
 * Retorna null si el endpoint no existe (404) o no hay campaña.
 *
 * @param {number|string} sedeId
 * @param {{ apiBaseUrl?: string; accessToken?: string }} [options]
 */
export async function fetchActivePadcoinsCampaignForSede(sedeId, options = {}) {
  const sid = Number.parseInt(String(sedeId ?? '').trim(), 10);
  if (!Number.isFinite(sid) || sid <= 0) return null;

  const apiBaseUrl = String(options.apiBaseUrl || '').replace(/\/$/, '');
  if (!apiBaseUrl) return null;

  const path = PADCOINS_PLAYER_ACTIVE_CAMPAIGN_ENDPOINT.replace(':sedeId', encodeURIComponent(String(sid)));
  const headers = { Accept: 'application/json' };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  try {
    const res = await fetch(`${apiBaseUrl}${path}`, { headers });
    if (res.status === 404 || res.status === 501) return null;
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return parsePlayerActiveCampaign(data);
  } catch {
    return null;
  }
}
