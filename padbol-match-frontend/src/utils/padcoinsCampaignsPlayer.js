/**
 * PadCoins — campañas activas visibles al jugador (frontend web).
 * Backend: GET /api/padcoins/sedes/:sedeId/active-campaign
 */

export const PADCOINS_PLAYER_ACTIVE_CAMPAIGN_ENDPOINT = '/api/padcoins/sedes/:sedeId/active-campaign';

const DEFAULT_BANNER_TITLE = 'Campaña PadCoins activa';
const DEFAULT_SLOT_LABEL = 'PadCoins extra';
const DEFAULT_CONFIRM_MESSAGE = 'Al confirmar esta reserva puedes sumar PadCoins extra por la campaña activa de esta sede.';
const DEFAULT_SUCCESS_MESSAGE = 'Reserva confirmada. Si cumple las condiciones de la campaña, los PadCoins extra se acreditarán automáticamente.';

function normalizeCampaignType(type) {
  return String(type || '').trim().toLowerCase();
}

/**
 * @param {unknown} data Respuesta API jugador
 * @returns {object|null}
 */
export function parsePlayerActiveCampaign(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.active === false || data.ok === false) return null;

  const raw = data.campaign;
  if (!raw || typeof raw !== 'object') return null;

  const type = normalizeCampaignType(raw.campaign_type);
  if (!type) return null;

  const displayRaw = raw.display && typeof raw.display === 'object' ? raw.display : {};

  return {
    id: raw.id ?? null,
    sede_id: raw.sede_id != null ? Number(raw.sede_id) : null,
    name: raw.name || '',
    description: raw.description || '',
    campaign_type: type,
    message_title: raw.message_title || '',
    message_body: raw.message_body || '',
    label: String(raw.label || '').trim(),
    start_at: raw.start_at || null,
    end_at: raw.end_at || null,
    display: {
      banner_title: String(displayRaw.banner_title || '').trim(),
      banner_text: String(displayRaw.banner_text || '').trim(),
      reservation_hint: String(displayRaw.reservation_hint || '').trim(),
      success_hint: String(displayRaw.success_hint || '').trim(),
    },
  };
}

/**
 * @param {ReturnType<typeof parsePlayerActiveCampaign>} campaign
 */
export function getPlayerCampaignSlotLabel(campaign) {
  if (!campaign) return '';
  return campaign.label || DEFAULT_SLOT_LABEL;
}

/**
 * @param {ReturnType<typeof parsePlayerActiveCampaign>} campaign
 */
export function getPlayerCampaignBannerTitle(campaign) {
  if (!campaign) return '';
  return campaign.display?.banner_title
    || campaign.message_title
    || DEFAULT_BANNER_TITLE;
}

/**
 * @param {ReturnType<typeof parsePlayerActiveCampaign>} campaign
 */
export function getPlayerCampaignBannerBody(campaign) {
  if (!campaign) return '';
  return campaign.display?.banner_text || campaign.message_body || '';
}

/**
 * @param {ReturnType<typeof parsePlayerActiveCampaign>} campaign
 */
export function getPlayerCampaignConfirmMessage(campaign) {
  if (!campaign) return '';
  return campaign.display?.reservation_hint || DEFAULT_CONFIRM_MESSAGE;
}

/**
 * @param {ReturnType<typeof parsePlayerActiveCampaign>} campaign
 */
export function getPlayerCampaignSuccessMessage(campaign) {
  if (!campaign) return '';
  return campaign.display?.success_hint || DEFAULT_SUCCESS_MESSAGE;
}

/**
 * Consulta campaña activa para una sede (jugador).
 * Retorna null si no hay campaña o si el endpoint falla.
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
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return parsePlayerActiveCampaign(data);
  } catch {
    return null;
  }
}
