/** Claves en sponsor_config.hub_jugar_slots (objeto JSON). */
export const HUB_JUGAR_SLOT = {
  BANNER_TOP: 'hub_jugar_banner_top',
  OVERLAY_RESERVAR: 'hub_jugar_overlay_reservar',
  OVERLAY_BUSCAR: 'hub_jugar_overlay_buscar',
  OVERLAY_ARMAR: 'hub_jugar_overlay_armar',
  STRIP: 'hub_jugar_strip',
  CARD_AD: 'hub_jugar_card_ad',
  CONFIRMACION_BANNER: 'hub_jugar_confirmacion_banner',
};

/** hubKey de JUGAR_OPCIONES_BASE → clave overlay */
export function hubJugarOverlayKeyForHubKey(hubKey) {
  const k = String(hubKey || '').trim();
  if (k === 'reservar') return HUB_JUGAR_SLOT.OVERLAY_RESERVAR;
  if (k === 'buscar_partido') return HUB_JUGAR_SLOT.OVERLAY_BUSCAR;
  if (k === 'armar_partido') return HUB_JUGAR_SLOT.OVERLAY_ARMAR;
  return null;
}

export function normalizeHubJugarSlot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { imagen_url: '', url_destino: '', texto_corto: '' };
  }
  return {
    imagen_url: String(raw.imagen_url || raw.logo_url || '').trim(),
    url_destino: String(raw.url_destino || '').trim(),
    texto_corto: String(raw.texto_corto || '').trim(),
  };
}
