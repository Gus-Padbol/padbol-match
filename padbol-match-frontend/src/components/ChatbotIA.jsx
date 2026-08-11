import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_BOTTOM_NAV_CONTENT_GAP_PX,
  HUB_NAV_HEIGHT_PX,
  sedePublicaChiviFabBottomCss,
  isChatbotIAVisiblePathname,
  isHubNavBarHiddenPathname,
  isJugadorHubShellPathname,
  isSedeProfilePathname,
} from '../constants/hubLayout';
import { hasDeportesPreferidosCargados } from '../constants/deportesPreferidos';
import SportIcon from './common/SportIcon';
import { useTheme } from '../context/ThemeContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { usePadbolLang, usePadbolLangVersion } from '../hooks/usePadbolLang';
import { useHubChiviAvatar } from '../hooks/useHubChiviAvatar';
import { CHIVI_AVATAR_DEFAULT_SRC } from '../constants/hubChiviConfig';
import { capitalizeName } from '../utils/displayName';
import { buildVoiceBookingCheckoutHref, resolveVoiceBookingConfirmation } from '../utils/chibiVoiceBooking';
import './ChatbotIA.css';

/** Ícono estilo Tabler `ti-microphone` (outline), `currentColor` para heredar color del botón. */
function TablerMicrophoneIcon({ size = 22 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

const MAX_USER_MESSAGES = 6;
/** Por encima de este número de turnos se agrupa por franja (si aplica más de una franja con datos). */
const DISPO_SLOTS_FRANJA_THRESHOLD = 8;
const CHAT_IA_GEO_DENIED_STORAGE_KEY = 'padbol_match_chat_ia_geo_denied';
/** Si el usuario ya abrió el chat desde el FAB: mostrar solo el botón colapsado (logo + etiqueta). */
const CHATBOT_SEEN_STORAGE_KEY = 'chatbot_seen';
const CHATBOT_FAB_EXPAND_MS = 4000;

function readChatbotFabInitiallyCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CHATBOT_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

export function publicLandingKnowledgeAnswer(rawQuestion, locale = 'es') {
  const q = String(rawQuestion || '').trim().toLowerCase();
  const l = locale === 'en' || locale === 'pt' ? locale : 'es';
  const copy = {
    es: {
      venue: 'Para las sedes, Padbol Match integra canchas, horarios, precios, cobros, reservas, jugadores, torneos, resultados y comunicación. También ofrece información operativa y módulos como marcador inteligente, PadCoins y membresías cuando están habilitados.',
      player: 'Los jugadores pueden encontrar o crear partidos, sumarse a cupos abiertos, reservar, competir y seguir resultados, historial, ranking y comunidad desde un mismo recorrido.',
      today: 'Hoy están disponibles la operación de sedes, reservas, partidos, torneos, rankings, comunidad y el marcador inteligente. El árbitro de visión está en entrenamiento y la tienda avanza como piloto.',
      scoreboard: 'El marcador inteligente registra el partido en vivo y conecta el resultado con historial, estadísticas, rankings y torneos cuando corresponde. El árbitro de visión por cámaras todavía está en entrenamiento.',
      reports: 'Padbol Match entrega resúmenes y exportaciones del movimiento operativo de la sede. Esa información no es asesoramiento contable, fiscal ni legal; cada sede la utiliza con sus profesionales según su país.',
      loyalty: 'PadCoins y membresías permiten reconocer participación y sostener el vínculo con la sede cuando esos módulos están habilitados. La sede define sus beneficios y condiciones.',
      commerce: 'Las sedes pueden gestionar oportunidades de sponsors y publicidad. Padbol Match Shop todavía funciona como piloto y no debe presentarse como una tienda plenamente disponible.',
      about: 'Padbol Match nace de 18 años desarrollando Padbol. Gustavo Miguens es creador de Padbol, presidente de la Federación Internacional de Padbol y fundador de Padbol Match.',
      price: 'Los precios y condiciones dependen de la propuesta para cada sede. Para una respuesta comercial concreta, podés usar el canal de contacto de Padbol Match en /contacto.',
      join: 'Podés conocer la propuesta para sedes en /administradores e iniciar la solicitud en /unirse. Para una conversación comercial, el canal general está en /contacto.',
      general: 'Padbol Match conecta juego, operación y comunidad para Padbol, pádel, pickleball y tenis. Reúne jugadores, sedes, reservas, partidos, competencia, resultados y gestión en una misma plataforma.',
    },
    en: {
      venue: 'For venues, Padbol Match brings together courts, schedules, prices, payments, bookings, players, tournaments, results and communication. It also provides operational information and modules such as the smart scoreboard, PadCoins and memberships when enabled.',
      player: 'Players can find or create matches, join open spots, book, compete and follow results, history, rankings and community activity in one journey.',
      today: 'Venue operations, bookings, matches, tournaments, rankings, community and the smart scoreboard are available today. The vision referee is in training and the shop remains a pilot.',
      scoreboard: 'The smart scoreboard records matches live and connects results with history, statistics, rankings and tournaments when applicable. The camera-vision referee is still in training.',
      reports: 'Padbol Match provides summaries and exports of venue operations. This is not accounting, tax or legal advice; each venue uses the information with its professionals under local law.',
      loyalty: 'PadCoins and memberships can recognize participation and strengthen the venue relationship when those modules are enabled. The venue defines its benefits and terms.',
      commerce: 'Venues can manage sponsorship and advertising opportunities. Padbol Match Shop remains a pilot and should not be presented as fully available.',
      about: 'Padbol Match grows from 18 years of developing Padbol. Gustavo Miguens created Padbol, presides over the International Padbol Federation and founded Padbol Match.',
      price: 'Pricing and conditions depend on each venue proposal. For a specific commercial answer, use the Padbol Match contact channel at /contacto.',
      join: 'Learn about the venue proposal at /administradores and start an application at /unirse. The general commercial channel is /contacto.',
      general: 'Padbol Match connects play, operations and community for Padbol, padel, pickleball and tennis. It brings players, venues, bookings, matches, competition, results and management into one platform.',
    },
    pt: {
      venue: 'Para as sedes, Padbol Match reúne quadras, horários, preços, pagamentos, reservas, jogadores, torneios, resultados e comunicação, além de informação operacional e módulos como placar inteligente, PadCoins e assinaturas quando habilitados.',
      player: 'Jogadores podem encontrar ou criar partidas, entrar em vagas abertas, reservar, competir e acompanhar resultados, histórico, ranking e comunidade em uma só jornada.',
      today: 'Operação de sedes, reservas, partidas, torneios, rankings, comunidade e placar inteligente estão disponíveis hoje. O árbitro de visão está em treinamento e a loja segue como piloto.',
      scoreboard: 'O placar inteligente registra a partida ao vivo e conecta o resultado ao histórico, estatísticas, rankings e torneios quando aplicável. O árbitro por câmeras ainda está em treinamento.',
      reports: 'Padbol Match oferece resumos e exportações da operação da sede. Isso não é assessoria contábil, fiscal ou jurídica; cada sede usa a informação com seus profissionais conforme a lei local.',
      loyalty: 'PadCoins e assinaturas podem reconhecer a participação e fortalecer o vínculo com a sede quando esses módulos estão habilitados. A sede define benefícios e condições.',
      commerce: 'As sedes podem administrar oportunidades de patrocínio e publicidade. Padbol Match Shop continua como piloto e não deve ser apresentada como totalmente disponível.',
      about: 'Padbol Match nasce de 18 anos desenvolvendo Padbol. Gustavo Miguens criou o Padbol, preside a Federação Internacional de Padbol e fundou o Padbol Match.',
      price: 'Preços e condições dependem da proposta para cada sede. Para uma resposta comercial específica, use o canal /contacto.',
      join: 'Conheça a proposta para sedes em /administradores e inicie a solicitação em /unirse. O canal comercial geral é /contacto.',
      general: 'Padbol Match conecta jogo, operação e comunidade para Padbol, padel, pickleball e tênis. Reúne jogadores, sedes, reservas, partidas, competição, resultados e gestão em uma plataforma.',
    },
  }[l];

  if (/sede|club|venue|court|quadra|administr/.test(q)) return copy.venue;
  if (/jugador|player|jogador|partido|match|jugar|play|jogar/.test(q)) return copy.player;
  if (/disponible|available|disponível|hoy|today|hoje|actual/.test(q)) return copy.today;
  if (/marcador|scoreboard|placar|visión|vision|árbitro|referee/.test(q)) return copy.scoreboard;
  if (/reporte|report|informe|excel|contab|fiscal|tax|export/.test(q)) return copy.reports;
  if (/padcoin|membres|beneficio|benefit|fidel/.test(q)) return copy.loyalty;
  if (/sponsor|publicidad|advert|shop|tienda|loja/.test(q)) return copy.commerce;
  if (/quién|quien|who|quem|historia|fundador|gustavo/.test(q)) return copy.about;
  if (/precio|price|preço|costo|cost|plan/.test(q)) return copy.price;
  if (/sumar|incorpor|join|contact|contacto|hablar|talk|falar/.test(q)) return copy.join;
  return copy.general;
}

/** yyyy-LL-dd en America/Argentina/Buenos_Aires (referencia cruzada con el servidor en /api/chat-ia). */
function ymdBuenosAires(d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const mo = parts.find((p) => p.type === 'month')?.value;
    const da = parts.find((p) => p.type === 'day')?.value;
    if (y && mo && da) return `${y}-${mo}-${da}`;
  } catch (_) {
    /* ignore */
  }
  return '';
}

/** Minutos desde medianoche a partir de `hora_inicio` (ej. "09:30" o "09:30:00"). */
function horaInicioSlotToMinutes(horaInicio) {
  const str = String(horaInicio || '').trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/**
 * Franjas según especificación: mañana 08:00–12:59, tarde 13:00–17:59, noche 18:00–23:59.
 * Horas fuera de 08–24 se asignan a la franja más cercana para no perder chips.
 */
function slotFranjaKey(horaInicio) {
  const min = horaInicioSlotToMinutes(horaInicio);
  if (min == null) return 'manana';
  if (min < 8 * 60) return 'manana';
  if (min <= 12 * 60 + 59) return 'manana';
  if (min <= 17 * 60 + 59) return 'tarde';
  return 'noche';
}

function groupDisponibilidadSlotsByFranja(slots) {
  const out = { manana: [], tarde: [], noche: [] };
  if (!Array.isArray(slots)) return out;
  for (const s of slots) {
    const k = slotFranjaKey(s?.hora_inicio);
    out[k].push(s);
  }
  return out;
}

const FRANJA_KEYS = ['manana', 'tarde', 'noche'];

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isSpeechRecognitionAvailable() {
  return getSpeechRecognitionCtor() != null;
}

function isSpeechSynthesisAvailable() {
  if (typeof window === 'undefined') return false;
  const s = window.speechSynthesis;
  return !!(s && typeof s.speak === 'function');
}

/** Breve pausa tras cerrar el mic antes de enviar el texto (UX “Procesando…”). */
const VOICE_POST_TRANSCRIPT_MS = 420;
/** Sin transcripción con contenido en este tiempo → cancelar y avisar. */
const VOICE_SILENCE_MS = 8000;

function normalizeUiLocale(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 24);
  if (!s) return 'es';
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('pt')) return 'pt';
  if (s.startsWith('en')) return 'en';
  return 'es';
}

/** Etiqueta corta para chips de elección de deporte (slug canónico del backend). */
function deporteSlugDisplayLabel(slug, loc) {
  const s = String(slug || '').trim().toLowerCase();
  const l = normalizeUiLocale(loc);
  const maps = {
    es: {
      padbol: 'Padbol',
      padel: 'Pádel',
      tenis: 'Tenis',
      pickleball: 'Pickleball',
    },
    en: {
      padbol: 'Padbol',
      padel: 'Padel',
      tenis: 'Tennis',
      pickleball: 'Pickleball',
    },
    pt: {
      padbol: 'Padbol',
      padel: 'Padel',
      tenis: 'Tênis',
      pickleball: 'Pickleball',
    },
  };
  const m = maps[l] || maps.es;
  return m[s] || s.replace(/_/g, ' ');
}

/** es|en|pt según el texto escrito por el usuario (heurística alineada con el backend). */
function inferWritingLocaleCodeFromText(textRaw) {
  const text = String(textRaw || '').trim();
  if (!text) return 'es';
  const fold = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const pad = ` ${fold.replace(/\s+/g, ' ')} `;

  let pt = 0;
  let es = 0;
  let en = 0;

  if (/[ãõ]|\b(nao|nao)\b/i.test(text) || /não/i.test(text)) pt += 4;
  if (/ñ|¿|¡/.test(text)) es += 4;
  if (/\b(nao|nao|voce|voces|torneio|obrigado|obrigada|quadras|disponivel|tambem|amanha)\b/.test(pad)) pt += 3;
  if (/\b(manana|hoy|cuando|donde|cancha|turno|disponibilidad|quiero|gracias|sedes?|horarios)\b/.test(pad)) es += 3;
  if (/\b(tomorrow|today|when|where|booking|available|slot|courts|tournament|thanks|please|what\s+time|how\s+do)\b/.test(pad)) en += 3;
  if (/\b(voce|voces)\b/.test(pad)) pt += 2;
  if (/\b(the|and|with|for)\b/.test(pad)) en += 1;
  if (/\b(el|la|los|las|una|por|para)\b/.test(pad)) es += 1;

  if (pt > es && pt > en) return 'pt';
  if (en > es && en > pt) return 'en';
  return 'es';
}

/**
 * BCP-47 para SpeechSynthesis según el texto de la respuesta del asistente (no dispositivo ni mensaje del usuario).
 */
function bcp47LangForAssistantTts(textRaw) {
  const text = String(textRaw || '').trim();
  if (!text) return 'es-AR';

  // Scripts (orden: no latinos primero)
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'ar-SA';
  if (/[\u0590-\u05FF]/.test(text)) return 'he-IL';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru-RU';
  if (/[\u0370-\u03FF]/.test(text)) return 'el-GR';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th-TH';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
  if (/[\uAC00-\uD7A3]/.test(text)) return 'ko-KR';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';

  // Rumano (diacríticos típicos o palabras sin diacríticos comunes)
  if (/[\u0103\u0102\u00E2\u00C2\u00EE\u00CE\u0219\u0218\u021b\u021B]/.test(text)) return 'ro-RO';
  if (/\b(multumesc|mulțumesc|bun[ăa]\s+ziua|pe\s+m[aâ]ine|ast[ăa]zi|v[aă]\s+rog|sigur)\b/i.test(text)) return 'ro-RO';

  // Turco / alemán / francés (latinos con señales fuertes)
  if (/[ğüşöçıİĞÜŞÖÇ]/.test(text)) return 'tr-TR';
  if (/[äöüÄÖÜß]/.test(text)) return 'de-DE';
  if (
    /[àâçéèêëïîôùûüÿœæ]/.test(text) &&
    /\b(merci|bonjour|bonsoir|monsieur|madame|au\s+revoir|vous|nous|avec|pour)\b/i.test(text) &&
    !/\b(hola|gracias|cancha|mañana|dónde)\b/i.test(text)
  ) {
    return 'fr-FR';
  }

  const code = inferWritingLocaleCodeFromText(text);
  if (code === 'pt') return 'pt-BR';
  if (code === 'en') return 'en-US';
  return 'es-AR';
}

function navigatorLanguageToChatCode(nav) {
  const n = String(nav || 'es').toLowerCase();
  if (n.startsWith('pt')) return 'pt';
  if (n.startsWith('en')) return 'en';
  return 'es';
}

function chatUiStringsFromI18n(tr, loc) {
  const l = normalizeUiLocale(loc);
  const welcomeAssistant = (firstName) => {
    const n = capitalizeName(firstName);
    const lead = n ? tr('chatbot.welcomeLeadNamed', { name: n }) : tr('chatbot.welcomeLead');
    return tr('chatbot.welcomeAssistant', { lead });
  };
  return {
    escribiendo: tr('chatbot.escribiendo'),
    procesando: tr('chatbot.procesando'),
    enviar: tr('chatbot.enviar'),
    placeholder: tr('chatbot.placeholder'),
    waEscalada: tr('chatbot.waEscalada'),
    waClub: tr('chatbot.waClub'),
    fabOpen: tr('chatbot.fabOpen'),
    fabCollapsed: tr('chatbot.boton', { defaultValue: '¿Consultas?' }),
    fabLine1: tr('chatbot.fabLine1'),
    fabLine2: tr('chatbot.fabLine2'),
    titulo: tr('chatbot.titulo'),
    cargando: tr('chatbot.cargando'),
    escuchando: tr('chatbot.escuchando'),
    sinVoz: tr('chatbot.sinVoz'),
    noReconocer: tr('chatbot.noReconocer'),
    limiteSesion: tr('chatbot.limiteSesion'),
    verSedePrimario: (nombre) =>
      nombre ? tr('chatbot.verSedePrimarioNamed', { name: nombre }) : tr('chatbot.verSedePrimario'),
    limiteCtaJugar: tr('chatbot.limiteCtaJugar'),
    limiteCtaVerSede: tr('chatbot.limiteCtaVerSede'),
    nuevaConsultaSesion: tr('chatbot.nuevaConsultaSesion'),
    cerrar: tr('chatbot.cerrar'),
    micRecordingAria: tr('chatbot.micRecordingAria'),
    micProcessingAria: tr('chatbot.micProcessingAria'),
    micDictateAria: tr('chatbot.micDictateAria'),
    reservaLink: tr('chatbot.reservaLink'),
    reservaLinkTitle: tr('chatbot.reservaLinkTitle'),
    leerVozAlta: tr('chatbot.leerVozAlta'),
    escucharUltimaIos: tr('chatbot.escucharUltimaIos'),
    hintIosSafari: tr('chatbot.hintIosSafari'),
    ttsDetener: tr('chatbot.ttsDetener'),
    errMicDenied: tr('chatbot.errMicDenied'),
    errVoiceStart: tr('chatbot.errVoiceStart'),
    slotsDisponiblesTitulo: tr('chatbot.slotsDisponiblesTitulo'),
    confirmarTurnoTitulo: tr('chatbot.confirmarTurnoTitulo', { defaultValue: l === 'en' ? 'Confirm your court' : l === 'pt' ? 'Confirme sua quadra' : 'Confirmá tu cancha' }),
    confirmarTurnoDetalle: (sede, cancha, fecha, hora) =>
      l === 'en'
        ? `${sede} · ${cancha} · ${fecha} · ${hora}`
        : l === 'pt'
          ? `${sede} · ${cancha} · ${fecha} · ${hora}`
          : `${sede} · ${cancha} · ${fecha} · ${hora}`,
    confirmarTurnoAviso: tr('chatbot.confirmarTurnoAviso', { defaultValue: l === 'en' ? 'We will recheck availability before payment.' : l === 'pt' ? 'Vamos verificar a disponibilidade novamente antes do pagamento.' : 'Vamos a validar la disponibilidad otra vez antes del pago.' }),
    confirmarTurnoCta: tr('chatbot.confirmarTurnoCta', { defaultValue: l === 'en' ? 'Yes, continue' : l === 'pt' ? 'Sim, continuar' : 'Sí, continuar' }),
    cancelarTurnoCta: tr('chatbot.cancelarTurnoCta', { defaultValue: l === 'en' ? 'Choose another time' : l === 'pt' ? 'Escolher outro horário' : 'Elegir otro horario' }),
    deportesElegirTitulo: tr('chatbot.deportesElegirTitulo'),
    deporteElegirLabel: (slug) =>
      tr(`torneos.deporte.${slug}`, { defaultValue: deporteSlugDisplayLabel(slug, l) }),
    franjaManana: tr('chatbot.franjaManana'),
    franjaTarde: tr('chatbot.franjaTarde'),
    franjaNoche: tr('chatbot.franjaNoche'),
    welcomeAssistant,
    welcomeDeportesHint: tr('chatbot.welcomeDeportesHint'),
    quickSuggestions: [
      { label: tr('chatbot.quickTodaySlots') },
      { label: tr('chatbot.quickFindGame'), to: '/jugar/buscar' },
      { label: tr('chatbot.torneosSugerencia'), to: '/competir' },
      { label: tr('chatbot.quickBookCourt') },
    ],
  };
}

function chatUiStrings(loc, tr) {
  const l = normalizeUiLocale(loc);
  if (tr) {
    return chatUiStringsFromI18n(tr, loc);
  }
  if (l === 'en') {
    return {
      escribiendo: 'Writing…',
      procesando: 'Processing…',
      enviar: 'Send',
      placeholder: 'E.g. I want to play tomorrow at 7pm',
      waEscalada: 'Contact the club on WhatsApp',
      waClub: 'Message your usual club',
      fabOpen: 'Open Chivi assistant',
      fabCollapsed: 'Questions?',
      fabLine1: 'Questions?',
      fabLine2: 'Chat with Chivi',
      titulo: 'Chivi',
      cargando: 'Loading…',
      escuchando: 'Listening…',
      sinVoz: 'No voice detected. Try again.',
      noReconocer: 'Could not recognize speech. Try again.',
      limiteSesion: 'You have reached the limit for this session.',
      verSedePrimario: (nombre) => (nombre ? `See ${nombre}` : 'See club'),
      limiteCtaJugar: 'Play',
      limiteCtaVerSede: 'See club',
      nuevaConsultaSesion: 'New chat',
      cerrar: 'Close',
      micRecordingAria: 'Recording — tap again to cancel',
      micProcessingAria: 'Processing dictation',
      micDictateAria: 'Voice input',
      reservaLink: 'Go to booking',
      reservaLinkTitle: 'Open the booking form with the details shown',
      leerVozAlta: 'Read replies aloud',
      escucharUltimaIos: 'Play last reply (iOS / Safari)',
      hintIosSafari: 'On iPhone or iPad, audio may need an extra tap after the reply loads.',
      ttsDetener: 'Stop',
      errMicDenied: 'Microphone permission denied. Enable it in the browser and try again.',
      errVoiceStart: 'Could not start speech recognition.',
      slotsDisponiblesTitulo: 'Free slots (tap to book):',
      confirmarTurnoTitulo: 'Confirm your court',
      confirmarTurnoDetalle: (sede, cancha, fecha, hora) => `${sede} · ${cancha} · ${fecha} · ${hora}`,
      confirmarTurnoAviso: 'We will recheck availability before payment.',
      confirmarTurnoCta: 'Yes, continue',
      cancelarTurnoCta: 'Choose another time',
      deportesElegirTitulo: 'Sports at this club (tap one):',
      deporteElegirLabel: (slug) => deporteSlugDisplayLabel(slug, l),
      franjaManana: 'Morning',
      franjaTarde: 'Afternoon',
      franjaNoche: 'Evening',
      welcomeAssistant: (firstName) => {
        const n = capitalizeName(firstName);
        const lead = n ? `Hi ${n}.` : 'Hi.';
        return `${lead} I'm Chivi, your Padbol Match assistant. I can help you book a court, find a game nearby, or check tournaments. What do you need?`;
      },
      welcomeDeportesHint:
        'By the way, if you tell me which sports you play I can help you better.',
      quickSuggestions: [
        { label: "See today's court times" },
        { label: 'Find a game nearby', to: '/jugar/buscar' },
        { label: 'Available tournaments', to: '/competir' },
        { label: 'Book a court' },
      ],
    };
  }
  if (l === 'pt') {
    return {
      escribiendo: 'Escrevendo…',
      procesando: 'Processando…',
      enviar: 'Enviar',
      placeholder: 'Ex.: quero jogar amanhã às 19h',
      waEscalada: 'Falar com o clube no WhatsApp',
      waClub: 'Escrever ao clube habitual',
      fabOpen: 'Abrir assistente Chivi',
      fabCollapsed: 'Dúvidas?',
      fabLine1: 'Tem dúvidas?',
      fabLine2: 'Fale com a Chivi',
      titulo: 'Chivi',
      cargando: 'Carregando…',
      escuchando: 'Ouvindo…',
      sinVoz: 'Nenhuma voz detectada. Tente de novo.',
      noReconocer: 'Não foi possível reconhecer. Tente de novo.',
      limiteSesion: 'Você chegou ao limite desta sessão.',
      verSedePrimario: (nombre) => (nombre ? `Ver ${nombre}` : 'Ver clube'),
      limiteCtaJugar: 'Jogar',
      limiteCtaVerSede: 'Ver clube',
      nuevaConsultaSesion: 'Nova conversa',
      cerrar: 'Fechar',
      micRecordingAria: 'Gravando — toque de novo para cancelar',
      micProcessingAria: 'Processando ditado',
      micDictateAria: 'Ditar por voz',
      reservaLink: 'Ir para reservar',
      reservaLinkTitle: 'Abrir o formulário de reserva com os dados indicados',
      leerVozAlta: 'Ler respostas em voz alta',
      escucharUltimaIos: 'Ouvir última resposta (iOS / Safari)',
      hintIosSafari: 'No iPhone ou iPad, o áudio pode exigir um toque extra após carregar a resposta.',
      ttsDetener: 'Parar',
      errMicDenied: 'Permissão do microfone negada. Ative no navegador e tente de novo.',
      errVoiceStart: 'Não foi possível iniciar o reconhecimento de voz.',
      slotsDisponiblesTitulo: 'Horários livres (toque para reservar):',
      confirmarTurnoTitulo: 'Confirme sua quadra',
      confirmarTurnoDetalle: (sede, cancha, fecha, hora) => `${sede} · ${cancha} · ${fecha} · ${hora}`,
      confirmarTurnoAviso: 'Vamos verificar a disponibilidade novamente antes do pagamento.',
      confirmarTurnoCta: 'Sim, continuar',
      cancelarTurnoCta: 'Escolher outro horário',
      deportesElegirTitulo: 'Esportes neste clube (toque em um):',
      deporteElegirLabel: (slug) => deporteSlugDisplayLabel(slug, l),
      franjaManana: 'Manhã',
      franjaTarde: 'Tarde',
      franjaNoche: 'Noite',
      welcomeAssistant: (firstName) => {
        const n = capitalizeName(firstName);
        const lead = n ? `Olá ${n}.` : 'Olá.';
        return `${lead} Sou a Chivi, sua assistente Padbol Match. Posso ajudar a reservar quadra, buscar partida perto ou consultar torneios. O que você precisa?`;
      },
      welcomeDeportesHint:
        'Ah, e se você me disser quais esportes pratica posso ajudar melhor.',
      quickSuggestions: [
        { label: 'Ver horários hoje' },
        { label: 'Buscar partida perto', to: '/jugar/buscar' },
        { label: 'Torneios disponíveis', to: '/competir' },
        { label: 'Reservar quadra' },
      ],
    };
  }
  return {
    escribiendo: 'Escribiendo…',
    procesando: 'Procesando…',
    enviar: 'Enviar',
    placeholder: 'Ej: quiero jugar mañana a las 19hs',
    waEscalada: 'Contactar al club por WhatsApp',
    waClub: 'Escribir al club habitual',
    fabOpen: 'Abrir asistente Chivi',
    fabCollapsed: '¿Consultas?',
    fabLine1: '¿Tenés dudas?',
    fabLine2: 'Hablá con Chivi',
    titulo: 'Chivi',
    cargando: 'Cargando…',
    escuchando: 'Escuchando…',
    sinVoz: 'No se detectó voz. Intenta de nuevo.',
    noReconocer: 'No se pudo reconocer. Intenta de nuevo.',
    limiteSesion: 'Llegaste al límite de esta sesión.',
    verSedePrimario: (nombre) => (nombre ? `Ver ${nombre}` : 'Ver sede'),
    limiteCtaJugar: 'Jugar',
    limiteCtaVerSede: 'Ver sede',
    nuevaConsultaSesion: 'Nueva consulta',
    cerrar: 'Cerrar',
    micRecordingAria: 'Grabando: pulsa de nuevo para cancelar',
    micProcessingAria: 'Procesando dictado',
    micDictateAria: 'Dictar por voz',
    reservaLink: 'Ir a reservar',
    reservaLinkTitle: 'Abrir formulario de reserva con los datos indicados',
    leerVozAlta: 'Leer respuestas en voz alta',
    escucharUltimaIos: 'Escuchar última respuesta (iOS / Safari)',
    hintIosSafari: 'En iPhone o iPad el audio puede requerir un toque explícito después de cargar la respuesta.',
    ttsDetener: 'Detener',
    errMicDenied: 'Permiso de micrófono denegado. Activa el permiso en el navegador e intenta de nuevo.',
    errVoiceStart: 'No se pudo iniciar el reconocimiento de voz.',
    slotsDisponiblesTitulo: 'Turnos libres (toca para reservar):',
    confirmarTurnoTitulo: 'Confirmá tu cancha',
    confirmarTurnoDetalle: (sede, cancha, fecha, hora) => `${sede} · ${cancha} · ${fecha} · ${hora}`,
    confirmarTurnoAviso: 'Vamos a validar la disponibilidad otra vez antes del pago.',
    confirmarTurnoCta: 'Sí, continuar',
    cancelarTurnoCta: 'Elegir otro horario',
    deportesElegirTitulo: 'Deportes en esta sede (toca uno):',
    deporteElegirLabel: (slug) => deporteSlugDisplayLabel(slug, l),
    franjaManana: 'Mañana',
    franjaTarde: 'Tarde',
    franjaNoche: 'Noche',
    welcomeAssistant: (firstName) => {
      const n = capitalizeName(firstName);
      const lead = n ? `Hola ${n}.` : 'Hola.';
      return `${lead} Soy Chivi, tu asistente de Padbol Match. Puedo ayudarte a reservar cancha, buscar partido o consultar torneos. ¿Qué necesitas?`;
    },
    welcomeDeportesHint:
      'Por cierto, si me cuentas qué deportes practicas te puedo ayudar mejor.',
    quickSuggestions: [
      { label: 'Ver horarios hoy' },
      { label: 'Buscar partido cerca', to: '/jugar/buscar' },
      { label: 'Torneos disponibles', to: '/competir' },
      { label: 'Reservar cancha' },
    ],
  };
}

/** Paleta del modal del asistente (inline styles; alineado a gray-900/800/700 en oscuro). */
function getChatbotModalTheme(isDark) {
  if (isDark) {
    return {
      panelBg: '#111827',
      borderHairline: '#374151',
      headerBg: 'linear-gradient(135deg,#1f2937,#111827)',
      titleColor: '#ffffff',
      closeColor: '#9ca3af',
      scrollBg: '#111827',
      welcomeBg: '#1f2937',
      welcomeColor: '#ffffff',
      assistantBg: '#1f2937',
      assistantColor: '#ffffff',
      userBg: '#E11B22',
      userColor: '#ffffff',
      secondaryLabel: '#9ca3af',
      chipBg: '#1f2937',
      chipBorder: '#4b5563',
      chipColor: '#ffffff',
      franjaInactiveBg: '#1f2937',
      franjaActiveBg: '#374151',
      franjaBorderActive: '#E11B22',
      franjaBorderInactive: '#4b5563',
      franjaCount: '#9ca3af',
      franjaText: '#ffffff',
      slotBg: 'rgba(229, 57, 53, 0.125)',
      slotColor: '#e53935',
      slotBorder: '#e53935',
      loadingColor: '#9ca3af',
      errorColor: '#fca5a5',
      footerTopBorder: '#374151',
      readAloudColor: '#9ca3af',
      inputBg: '#1f2937',
      inputColor: '#ffffff',
      inputBorder: '#4b5563',
      micBg: '#1f2937',
      micBorder: '#4b5563',
      dictationBg: '#1f2937',
      dictationBorder: '#4b5563',
      dictationSolid: '#ffffff',
      dictationInterim: '#9ca3af',
      iosTapBg: '#1f2937',
      iosTapColor: '#ffffff',
      iosTapBorder: '#4b5563',
      hintIos: '#9ca3af',
      voiceStatus: '#fbbf24',
      voiceNotice: '#fdba74',
      reservaCtaBg: '#E11B22',
      limitePrimaryCta: '#E11B22',
      sessionBoxBg: '#422006',
      sessionBoxBorder: '#b45309',
      sessionBoxText: '#fcd34d',
      nuevaConsultaBg: 'transparent',
      nuevaConsultaBorder: '#ca8a04',
      nuevaConsultaText: '#fcd34d',
      stopTtsBg: '#450a0a',
      stopTtsBorder: '#991b1b',
      stopTtsColor: '#fecaca',
      waEscalada: '#128C7E',
    };
  }
  return {
    panelBg: '#fff',
    borderHairline: '#e2e8f0',
    headerBg: 'linear-gradient(135deg,#eef2ff,#fff)',
    titleColor: '#1e293b',
    closeColor: '#64748b',
    scrollBg: 'transparent',
    welcomeBg: '#f1f5f9',
    welcomeColor: '#0f172a',
    assistantBg: '#f1f5f9',
    assistantColor: '#0f172a',
    userBg: '#E11B22',
    userColor: '#fff',
    secondaryLabel: '#475569',
    chipBg: '#fff',
    chipBorder: '#cbd5e1',
    chipColor: '#0f172a',
    franjaInactiveBg: '#fff',
    franjaActiveBg: '#eef2ff',
    franjaBorderActive: '#E11B22',
    franjaBorderInactive: '#cbd5e1',
    franjaCount: '#64748b',
    franjaText: '#0f172a',
    slotBg: 'rgba(229, 57, 53, 0.125)',
    slotColor: '#e53935',
    slotBorder: '#e53935',
    loadingColor: '#64748b',
    errorColor: '#b91c1c',
    footerTopBorder: '#e2e8f0',
    readAloudColor: '#64748b',
    inputBg: '#ffffff',
    inputColor: '#0f172a',
    inputBorder: '#cbd5e1',
    micBg: '#fff',
    micBorder: '#cbd5e1',
    dictationBg: '#fafafa',
    dictationBorder: '#cbd5e1',
    dictationSolid: '#0f172a',
    dictationInterim: '#94a3b8',
    iosTapBg: '#f8fafc',
    iosTapColor: '#0f172a',
    iosTapBorder: '#cbd5e1',
    hintIos: '#94a3b8',
    voiceStatus: '#b45309',
    voiceNotice: '#c2410c',
    reservaCtaBg: '#E11B22',
    limitePrimaryCta: '#E11B22',
    sessionBoxBg: '#fef3c7',
    sessionBoxBorder: '#fcd34d',
    sessionBoxText: '#78350f',
    nuevaConsultaBg: '#fffbeb',
    nuevaConsultaBorder: '#ca8a04',
    nuevaConsultaText: '#92400e',
    stopTtsBg: '#fef2f2',
    stopTtsBorder: '#fecaca',
    stopTtsColor: '#991b1b',
    waEscalada: '#128C7E',
  };
}

function QuickSuggestionBar({ items, disabled, onPick, isDark }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div
      style={{
        alignSelf: 'stretch',
        maxWidth: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        paddingBottom: 2,
        boxSizing: 'border-box',
      }}
    >
      {list.map((q, idx) => (
        <button
          key={`qs-row-${idx}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: 32,
            padding: '6px 12px',
            boxSizing: 'border-box',
            borderRadius: 9999,
            border: isDark ? '1px solid #4b5563' : '1px solid #d1d5f8',
            background: isDark ? '#374151' : 'transparent',
            color: isDark ? '#ffffff' : '#64748b',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            boxShadow: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

function ChiviFabAvatar({ size = 44, fill = false, src = CHIVI_AVATAR_DEFAULT_SRC }) {
  const [imgSrc, setImgSrc] = useState(src);
  useEffect(() => {
    setImgSrc(src || CHIVI_AVATAR_DEFAULT_SRC);
  }, [src]);
  return (
    <img
      src={imgSrc}
      alt="Chivi"
      className={`chatbot-fab-chivi-avatar${fill ? ' chatbot-fab-chivi-avatar--fill' : ''}`}
      style={fill ? undefined : { width: size, height: size }}
      onError={() => {
        if (imgSrc !== CHIVI_AVATAR_DEFAULT_SRC) setImgSrc(CHIVI_AVATAR_DEFAULT_SRC);
      }}
    />
  );
}

export default function ChatbotIA() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { navDock } = useHubNavLayout();
  const { session, userProfile, refreshSession } = useAuth();
  const { theme } = useTheme();
  const c = useMemo(() => getChatbotModalTheme(theme === 'dark'), [theme]);
  const [open, setOpen] = useState(false);
  const [fabCollapsed, setFabCollapsed] = useState(readChatbotFabInitiallyCollapsed);
  const [publicAttentionCycle, setPublicAttentionCycle] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  /** idle: sin dictado; listening: grabando; processing: entre fin de voz y envío al API */
  const [voicePhase, setVoicePhase] = useState('idle');
  const [voiceFinal, setVoiceFinal] = useState('');
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [readAloud, setReadAloud] = useState(false);
  /** True mientras `speechSynthesis` está reproduciendo la última respuesta del asistente. */
  const [ttsPlaying, setTtsPlaying] = useState(false);
  /** Despliegue por franja de turnos (índice del mensaje + franja) cuando hay >8 slots y varias franjas. */
  const [dispSlotsFranja, setDispSlotsFranja] = useState(null);
  const [lastReserve, setLastReserve] = useState(null);
  const [voiceBookingSelection, setVoiceBookingSelection] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [sedeContextoTurno, setSedeContextoTurno] = useState(null);
  const [whatsappEscalada, setWhatsappEscalada] = useState(null);
  const recRef = useRef(null);
  const listEndRef = useRef(null);
  const readAloudRef = useRef(readAloud);
  const uiRef = useRef(null);
  const voiceSendTimerRef = useRef(null);
  const voiceSilenceTimerRef = useRef(null);
  const voiceDictationBackupRef = useRef('');
  const voiceLatestTranscriptRef = useRef('');
  const voiceHeardNonEmptyRef = useRef(false);
  const voiceTimedOutRef = useRef(false);
  const voiceUserCancelledRef = useRef(false);
  const clientGeoRef = useRef(null);
  const publicAttentionRef = useRef({ lastY: 0, lastAt: 0 });
  const publicAttentionHashRef = useRef(location.hash);

  const micSupported = useMemo(() => isSpeechRecognitionAvailable(), []);
  const ttsSupported = useMemo(() => isSpeechSynthesisAvailable(), []);
  const isLikelyIOSWebKit = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const padbolLang = usePadbolLang();
  usePadbolLangVersion();
  const isPublicLanding = useMemo(() => {
    const p = String(location.pathname || '/').replace(/\/+$/, '') || '/';
    return p === '/plataforma';
  }, [location.pathname]);
  const ui = useMemo(() => {
    const base = chatUiStrings(padbolLang, t);
    if (!isPublicLanding) return base;
    if (padbolLang === 'en') {
      return {
        ...base,
        fabOpen: 'Talk to Chivi, Padbol Match AI assistant',
        fabCollapsed: 'Chivi AI',
        fabLine1: 'Questions?',
        fabLine2: 'Talk to Chivi AI',
        placeholder: 'Ask about Padbol Match',
        welcomeAssistant: () => 'Hi. I’m Chivi, Padbol Match’s AI assistant. Ask me how the platform works for players, venues and organizations.',
        quickSuggestions: [
          { label: 'What is Padbol Match?' },
          { label: 'What does it offer venues?' },
          { label: 'How does it work for players?' },
          { label: 'What is available today?' },
        ],
      };
    }
    if (padbolLang === 'pt') {
      return {
        ...base,
        fabOpen: 'Falar com Chivi, assistente de IA do Padbol Match',
        fabCollapsed: 'Chivi IA',
        fabLine1: 'Dúvidas?',
        fabLine2: 'Fale com Chivi IA',
        placeholder: 'Pergunte sobre o Padbol Match',
        welcomeAssistant: () => 'Olá. Sou Chivi, a assistente de IA do Padbol Match. Pergunte como a plataforma funciona para jogadores, sedes e organizações.',
        quickSuggestions: [
          { label: 'O que é Padbol Match?' },
          { label: 'O que oferece às sedes?' },
          { label: 'Como funciona para jogadores?' },
          { label: 'O que está disponível hoje?' },
        ],
      };
    }
    return {
      ...base,
      fabOpen: 'Hablar con Chivi, asistente de inteligencia artificial de Padbol Match',
      fabCollapsed: 'Chivi IA',
      fabLine1: '¿Tenés dudas?',
      fabLine2: 'Hablá con Chivi IA',
      placeholder: 'Preguntá sobre Padbol Match',
      welcomeAssistant: () => 'Hola. Soy Chivi, la asistente de inteligencia artificial de Padbol Match. Preguntame cómo funciona la plataforma para jugadores, sedes y organizaciones.',
      quickSuggestions: [
        { label: '¿Qué es Padbol Match?' },
        { label: '¿Qué ofrece a las sedes?' },
        { label: '¿Cómo funciona para jugadores?' },
        { label: '¿Qué está disponible hoy?' },
      ],
    };
  }, [isPublicLanding, padbolLang, t]);
  const { avatarUrl: chiviAvatarUrl } = useHubChiviAvatar();

  const chatWelcomeFirstName = useMemo(() => {
    const apodo = userProfile?.apodo != null ? String(userProfile.apodo).trim() : '';
    if (apodo) return capitalizeName(apodo);
    const ns = userProfile?.nombre_saludo != null ? String(userProfile.nombre_saludo).trim() : '';
    if (ns) return capitalizeName(ns);
    const nom = userProfile?.nombre != null ? String(userProfile.nombre).trim() : '';
    if (nom) {
      const first = nom.split(/\s+/).filter(Boolean)[0];
      return capitalizeName(first || nom);
    }
    const meta = session?.user?.user_metadata || {};
    const full = String(meta.full_name || meta.name || '').trim();
    if (full) {
      const first = full.split(/\s+/).filter(Boolean)[0] || full;
      return capitalizeName(first);
    }
    return '';
  }, [userProfile, session?.user]);

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  const lastMessageIsAssistant =
    messages.length > 0 && messages[messages.length - 1]?.role === 'assistant';

  const showQuickSuggestionBar =
    !loading && !sessionEnded && (messages.length === 0 || lastMessageIsAssistant);

  useEffect(() => {
    readAloudRef.current = readAloud;
  }, [readAloud]);

  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);
  const writingLocaleForVoice = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user' && String(messages[i].content || '').trim()) {
        return inferWritingLocaleCodeFromText(messages[i].content);
      }
    }
    return navigatorLanguageToChatCode(typeof navigator !== 'undefined' ? navigator.language : 'es');
  }, [messages]);

  const speechRecLang = useMemo(() => {
    const c = writingLocaleForVoice;
    if (c === 'en') return 'en-US';
    if (c === 'pt') return 'pt-BR';
    return 'es-AR';
  }, [writingLocaleForVoice]);

  const visible = useMemo(() => isChatbotIAVisiblePathname(location.pathname), [location.pathname]);

  const clientPaginaSedeId = useMemo(() => {
    const path = (location.pathname || '').split('?')[0] || '';
    const mSede = path.match(/^\/sede\/(\d+)\/?$/i);
    if (mSede) {
      const id = parseInt(mSede[1], 10);
      if (Number.isFinite(id) && id > 0) return id;
    }
    if (path === '/reservar') {
      const sp = new URLSearchParams(location.search || '');
      const q = sp.get('sedeId');
      const id = q != null && String(q).trim() !== '' ? parseInt(String(q).trim(), 10) : NaN;
      if (Number.isFinite(id) && id > 0) return id;
    }
    return null;
  }, [location.pathname, location.search]);

  const hubShell = useMemo(() => {
    const p = location.pathname.split('?')[0] || '/';
    return isJugadorHubShellPathname(p) || isSedeProfilePathname(p) || p === '/' || p === '/hub' || p === '/inicio' || p === '/home';
  }, [location.pathname]);

  const fabBottom = useMemo(() => {
    const pathOnly = (location.pathname || '').split('?')[0] || '/';
    const bottomNavShown = !isHubNavBarHiddenPathname(pathOnly);
    const liftForBottomNav =
      bottomNavShown && navDock === 'bottom'
        ? `(${HUB_NAV_HEIGHT_PX}px + ${HUB_BOTTOM_NAV_CONTENT_GAP_PX}px + env(safe-area-inset-bottom, 0px))`
        : 'env(safe-area-inset-bottom, 0px)';
    if (isSedeProfilePathname(pathOnly)) {
      return sedePublicaChiviFabBottomCss();
    }
    if (hubShell) {
      return `calc(${liftForBottomNav} + ${HUB_CONTENT_PADDING_BOTTOM_PX}px + 8px)`;
    }
    return `calc(16px + ${liftForBottomNav})`;
  }, [hubShell, location.pathname, navDock]);

  useEffect(() => {
    if (!visible) return undefined;
    if (fabCollapsed) return undefined;
    const tid = window.setTimeout(() => setFabCollapsed(true), CHATBOT_FAB_EXPAND_MS);
    return () => window.clearTimeout(tid);
  }, [visible, fabCollapsed]);

  useEffect(() => {
    if (!isPublicLanding || open || typeof window === 'undefined') return undefined;

    const attention = publicAttentionRef.current;
    attention.lastY = window.scrollY;
    if (!attention.lastAt) attention.lastAt = Date.now();

    const remind = () => {
      const now = Date.now();
      const travelled = Math.abs(window.scrollY - attention.lastY);
      const minTravel = Math.max(window.innerHeight * 1.35, 720);
      if (travelled < minTravel || now - attention.lastAt < 18000) return;
      attention.lastY = window.scrollY;
      attention.lastAt = now;
      setPublicAttentionCycle((cycle) => cycle + 1);
    };

    window.addEventListener('scroll', remind, { passive: true });
    return () => window.removeEventListener('scroll', remind);
  }, [isPublicLanding, open, location.hash]);

  useEffect(() => {
    const previousHash = publicAttentionHashRef.current;
    publicAttentionHashRef.current = location.hash;
    if (!isPublicLanding || open || !location.hash || location.hash === previousHash) return;
    publicAttentionRef.current.lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    publicAttentionRef.current.lastAt = Date.now();
    setPublicAttentionCycle((cycle) => cycle + 1);
  }, [isPublicLanding, location.hash, open]);

  const openChatFromFab = useCallback(() => {
    try {
      window.localStorage.setItem(CHATBOT_SEEN_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setFabCollapsed(true);
    setOpen(true);
    setError('');
    setVoiceNotice('');
  }, []);

  useEffect(() => {
    if (!open) return;
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages, loading, error, showQuickSuggestionBar]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    try {
      if (window.localStorage.getItem(CHAT_IA_GEO_DENIED_STORAGE_KEY) === '1') return;
    } catch {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
        clientGeoRef.current = {
          latitud: la,
          longitud: lo,
          precision_m:
            pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
              ? Math.round(pos.coords.accuracy)
              : null,
        };
      },
      () => {
        try {
          window.localStorage.setItem(CHAT_IA_GEO_DENIED_STORAGE_KEY, '1');
        } catch {
          /* ignore */
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    (async () => {
      try {
        const headers = {};
        const { data: sess } = await supabase.auth.getSession();
        const tok = sess?.session?.access_token;
        if (tok) headers.Authorization = `Bearer ${tok}`;
        const loc = (() => {
          for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i]?.role === 'user' && String(messages[i].content || '').trim()) {
              return inferWritingLocaleCodeFromText(messages[i].content);
            }
          }
          return navigatorLanguageToChatCode(typeof navigator !== 'undefined' ? navigator.language : 'es');
        })();
        const res = await fetch(`${API_BASE}/api/chat-ia/bootstrap?locale=${encodeURIComponent(loc)}`, {
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!canceled && res.ok) setBootstrap(data);
      } catch {
        if (!canceled) setBootstrap(null);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [open, session?.user?.id, messages]);

  const userMessageCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);

  const limiteSesionCta = useMemo(() => {
    const fromTurno = sedeContextoTurno?.id;
    const fromHab = bootstrap?.sede_habitual_id;
    const sid =
      fromTurno != null && Number.isFinite(Number(fromTurno)) && Number(fromTurno) > 0
        ? Number(fromTurno)
        : fromHab != null && Number.isFinite(Number(fromHab)) && Number(fromHab) > 0
          ? Number(fromHab)
          : null;
    if (sid != null) {
      const nombre =
        (sedeContextoTurno && Number(sedeContextoTurno.id) === sid && String(sedeContextoTurno.nombre || '').trim()) ||
        (bootstrap?.sede_habitual_id != null && Number(bootstrap.sede_habitual_id) === sid
          ? String(bootstrap.sede_habitual_nombre || '').trim()
          : '') ||
        '';
      return { href: `/sede/${encodeURIComponent(String(sid))}`, nombre };
    }
    return { href: '/jugar', nombre: '' };
  }, [sedeContextoTurno, bootstrap?.sede_habitual_id, bootstrap?.sede_habitual_nombre]);

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return String(messages[i].content || '').trim();
    }
    return '';
  }, [messages]);

  const clearVoiceSilenceTimer = useCallback(() => {
    if (voiceSilenceTimerRef.current != null) {
      window.clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(
    (opts) => {
      clearVoiceSilenceTimer();
      if (voiceSendTimerRef.current != null) {
        window.clearTimeout(voiceSendTimerRef.current);
        voiceSendTimerRef.current = null;
      }
      const rec = recRef.current;
      if (opts?.userCancelled) voiceUserCancelledRef.current = true;
      if (opts?.hard) {
        voiceUserCancelledRef.current = true;
        try {
          if (rec && typeof rec.abort === 'function') rec.abort();
          else rec?.stop?.();
        } catch {
          /* ignore */
        }
        recRef.current = null;
        setVoicePhase('idle');
        setVoiceFinal('');
        setVoiceInterim('');
        return;
      }
      if (!rec) {
        setVoicePhase('idle');
        setVoiceFinal('');
        setVoiceInterim('');
        return;
      }
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    [clearVoiceSilenceTimer],
  );

  useEffect(() => () => stopRecognition({ hard: true }), [stopRecognition]);

  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const speakAssistantReply = useCallback((text) => {
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!readAloudRef.current) return;
    const t = String(text || '').trim();
    if (!t) return;
    try {
      window.speechSynthesis.cancel();
      setTtsPlaying(false);
      const utter = new SpeechSynthesisUtterance(t);
      utter.onend = () => setTtsPlaying(false);
      utter.onerror = () => setTtsPlaying(false);
      utter.lang = bcp47LangForAssistantTts(t);
      utter.rate = 0.92;
      setTtsPlaying(true);
      window.speechSynthesis.speak(utter);
    } catch {
      setTtsPlaying(false);
    }
  }, [ttsSupported]);

  /** Llamar desde handlers de gesto del usuario (enviar, dictado, activar checkbox). */
  const primeSpeechSynthesisFromUserGesture = useCallback(() => {
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
  }, [ttsSupported]);

  const scheduleAssistantSpeak = useCallback(
    (reply) => {
      if (!ttsSupported) return;
      const run = () => {
        if (!readAloudRef.current) return;
        speakAssistantReply(reply);
      };
      run();
      window.setTimeout(() => {
        if (!readAloudRef.current) return;
        try {
          const s = window.speechSynthesis;
          if (s && !s.speaking && !s.pending) run();
        } catch {
          run();
        }
      }, isLikelyIOSWebKit ? 650 : 300);
    },
    [isLikelyIOSWebKit, speakAssistantReply, ttsSupported]
  );

  const sendMessage = useCallback(
    async (textRaw) => {
      const text = String(textRaw || '').trim();
      if (!text || loading || sessionEnded) return;

      // Cuando ya se eligió un horario, una respuesta corta por voz/texto no
      // debe volver al modelo: es la autorización explícita para abrir la
      // reserva real con el turno preseleccionado.
      const bookingAnswer = voiceBookingSelection
        ? resolveVoiceBookingConfirmation(text)
        : null;
      if (bookingAnswer) {
        primeSpeechSynthesisFromUserGesture();
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: text },
          {
            role: 'assistant',
            content:
              bookingAnswer === 'confirm'
                ? padbolLang === 'en'
                  ? 'Perfect. I will open the booking summary so you can review it and complete payment.'
                  : padbolLang === 'pt'
                    ? 'Perfeito. Vou abrir o resumo da reserva para você revisar e concluir o pagamento.'
                    : 'Perfecto. Voy a abrir el resumen de la reserva para que lo revises y completes el pago.'
                : padbolLang === 'en'
                  ? 'No problem. Choose another available time when you are ready.'
                  : padbolLang === 'pt'
                    ? 'Sem problema. Escolha outro horário disponível quando quiser.'
                    : 'No hay problema. Elegí otro horario disponible cuando quieras.',
          },
        ]);
        const selectedHref = voiceBookingSelection.href;
        setVoiceBookingSelection(null);
        if (bookingAnswer === 'confirm' && selectedHref) {
          setOpen(false);
          navigate(selectedHref);
        }
        return;
      }
      if (userMessageCount >= MAX_USER_MESSAGES) {
        setSessionEnded(true);
        return;
      }

      primeSpeechSynthesisFromUserGesture();
      setError('');
      const historial = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setInput('');
      setVoicePhase('idle');
      setVoiceFinal('');
      setVoiceInterim('');
      setVoiceNotice('');
      setLoading(true);
      setLastReserve(null);
      setSedeContextoTurno(null);
      setWhatsappEscalada(null);

      try {
        const headers = { 'Content-Type': 'application/json' };
        const { data: sess } = await supabase.auth.getSession();
        const tok = sess?.session?.access_token;
        if (tok) headers.Authorization = `Bearer ${tok}`;

        const res = await fetch(`${API_BASE}/api/chat-ia`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            mensaje: text,
            historial,
            user_id: session?.user?.id || null,
            locale: inferWritingLocaleCodeFromText(text),
            ...(isPublicLanding ? { client_surface: 'public_landing' } : {}),
            client_calendario_art: ymdBuenosAires(),
            ...(clientPaginaSedeId != null ? { client_pagina_sede_id: clientPaginaSedeId } : {}),
            ...(clientGeoRef.current &&
            Number.isFinite(Number(clientGeoRef.current.latitud)) &&
            Number.isFinite(Number(clientGeoRef.current.longitud))
              ? { client_geolocalizacion: clientGeoRef.current }
              : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.limit_reached) {
            setSessionEnded(true);
            const sc = data.sede_contexto;
            if (sc && sc.id != null && Number.isFinite(Number(sc.id)) && Number(sc.id) > 0) {
              setSedeContextoTurno({ id: Number(sc.id), nombre: String(sc.nombre || '').trim() });
            }
            setError('');
            setLoading(false);
            return;
          }
          if (isPublicLanding) {
            const fallbackReply = publicLandingKnowledgeAnswer(text, padbolLang);
            setMessages((prev) => [...prev, { role: 'assistant', content: fallbackReply }]);
            setError('');
            scheduleAssistantSpeak(fallbackReply);
          } else {
            setMessages((prev) => prev.slice(0, -1));
            setError(data?.error || res.statusText || 'Error');
          }
          return;
        }
        const reply = String(data.respuesta || '').trim() || 'Sin respuesta.';
        const dispRaw = data.disponibilidad;
        let disp = null;
        if (dispRaw && dispRaw.sede_id != null && dispRaw.fecha) {
          const slots = Array.isArray(dispRaw.slots) ? dispRaw.slots : [];
          const depEl = Array.isArray(dispRaw.deportes_eleccion)
            ? dispRaw.deportes_eleccion
                .map((d) => String(d || '').trim().toLowerCase())
                .filter(Boolean)
            : [];
          if (slots.length > 0 || depEl.length > 0) {
            disp = {
              sede_id: Number(dispRaw.sede_id),
              sede_nombre: String(dispRaw.sede_nombre || '').trim(),
              fecha: String(dispRaw.fecha).slice(0, 10),
              duracion_minutos: dispRaw.duracion_minutos,
              deporte_filtro:
                dispRaw.deporte_filtro != null && String(dispRaw.deporte_filtro).trim()
                  ? String(dispRaw.deporte_filtro).trim()
                  : null,
              slots,
              deportes_eleccion: depEl.length ? depEl : null,
            };
          }
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: reply, disponibilidad: disp }]);
        if (data.reserve?.href) setLastReserve(data.reserve);
        const sc = data.sede_contexto;
        if (sc && sc.id != null && Number.isFinite(Number(sc.id)) && Number(sc.id) > 0) {
          setSedeContextoTurno({ id: Number(sc.id), nombre: String(sc.nombre || '').trim() });
        } else {
          setSedeContextoTurno(null);
        }
        if (data.whatsapp_escalada?.href) setWhatsappEscalada(data.whatsapp_escalada);
        if (data.deporte_aprendido) {
          void refreshSession();
        }
        const used = Number(data.user_messages_used);
        if (Number.isFinite(used) && used >= MAX_USER_MESSAGES) setSessionEnded(true);
        scheduleAssistantSpeak(reply);
      } catch (e) {
        if (isPublicLanding) {
          const fallbackReply = publicLandingKnowledgeAnswer(text, padbolLang);
          setMessages((prev) => [...prev, { role: 'assistant', content: fallbackReply }]);
          setError('');
          scheduleAssistantSpeak(fallbackReply);
        } else {
          setMessages((prev) => prev.slice(0, -1));
          setError(e?.message || String(e));
        }
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      sessionEnded,
      messages,
      userMessageCount,
      session?.user?.id,
      clientPaginaSedeId,
      primeSpeechSynthesisFromUserGesture,
      scheduleAssistantSpeak,
      refreshSession,
      voiceBookingSelection,
      padbolLang,
      navigate,
      isPublicLanding,
    ]
  );

  const handleQuickSuggestion = useCallback(
    (item) => {
      const to = item && typeof item.to === 'string' ? item.to.trim() : '';
      if (to) {
        setOpen(false);
        navigate(to);
        return;
      }
      const label = item && item.label != null ? String(item.label).trim() : '';
      if (label) void sendMessage(label);
    },
    [navigate, sendMessage],
  );

  const startVoice = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !micSupported) return;
    if (voicePhase === 'processing' || loading || sessionEnded) return;
    if (voicePhase === 'listening') {
      stopRecognition({ userCancelled: true });
      return;
    }
    setVoiceNotice('');
    setError('');
    voiceUserCancelledRef.current = false;
    voiceTimedOutRef.current = false;
    voiceHeardNonEmptyRef.current = false;
    voiceDictationBackupRef.current = input;
    voiceLatestTranscriptRef.current = '';
    setVoiceFinal('');
    setVoiceInterim('');
    primeSpeechSynthesisFromUserGesture();

    let rec;
    try {
      rec = new Ctor();
    } catch (err) {
      if (!/kernel.*already registered|tensorflow|tfjs/i.test(String(err?.message || err))) {
        console.warn('[Padbol] Chatbot IA: SpeechRecognition no disponible.', err);
      }
      setVoicePhase('idle');
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechRecLang;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let finalP = '';
      let interP = '';
      const results = ev.results;
      if (results && results.length) {
        for (let i = 0; i < results.length; i += 1) {
          const piece = results[i][0]?.transcript ?? '';
          if (results[i].isFinal) finalP += piece;
          else interP += piece;
        }
      }
      const combined = (finalP + interP).trim();
      voiceLatestTranscriptRef.current = finalP + interP;
      setVoiceFinal(finalP);
      setVoiceInterim(interP);
      if (combined.length > 0) {
        clearVoiceSilenceTimer();
        voiceHeardNonEmptyRef.current = true;
      }
    };

    rec.onerror = (ev) => {
      clearVoiceSilenceTimer();
      const code = ev?.error || '';
      if (code === 'aborted') return;
      if (code === 'not-allowed') {
        const u = uiRef.current;
        setError(u?.errMicDenied || 'Permiso de micrófono denegado.');
        recRef.current = null;
        setVoicePhase('idle');
        setVoiceFinal('');
        setVoiceInterim('');
        setInput(voiceDictationBackupRef.current);
        return;
      }
      const u = uiRef.current;
      if (code === 'no-speech' || code === 'audio-capture') {
        setVoiceNotice(u?.sinVoz || 'No se detectó voz. Intenta de nuevo.');
      } else {
        setVoiceNotice(u?.noReconocer || 'No se pudo reconocer. Intenta de nuevo.');
      }
      recRef.current = null;
      setVoicePhase('idle');
      setVoiceFinal('');
      setVoiceInterim('');
      setInput(voiceDictationBackupRef.current);
    };

    rec.onend = () => {
      clearVoiceSilenceTimer();
      recRef.current = null;
      const t = String(voiceLatestTranscriptRef.current || '').trim();
      const backup = String(voiceDictationBackupRef.current ?? '');
      const cancelled = voiceUserCancelledRef.current;
      const timedOut = voiceTimedOutRef.current;
      voiceUserCancelledRef.current = false;
      voiceTimedOutRef.current = false;

      if (t) {
        setVoiceFinal('');
        setVoiceInterim('');
        setInput(t);
        setVoicePhase('processing');
        voiceSendTimerRef.current = window.setTimeout(() => {
          voiceSendTimerRef.current = null;
          void sendMessage(t);
        }, VOICE_POST_TRANSCRIPT_MS);
        return;
      }

      setVoicePhase('idle');
      setVoiceFinal('');
      setVoiceInterim('');
      setInput(backup);
      if (timedOut && !cancelled) {
        const u = uiRef.current;
        setVoiceNotice(u?.sinVoz || 'No se detectó voz. Intenta de nuevo.');
      }
    };

    recRef.current = rec;
    setVoicePhase('listening');
    voiceSilenceTimerRef.current = window.setTimeout(() => {
      voiceSilenceTimerRef.current = null;
      if (!voiceHeardNonEmptyRef.current) {
        voiceTimedOutRef.current = true;
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
    }, VOICE_SILENCE_MS);

    try {
      rec.start();
    } catch {
      clearVoiceSilenceTimer();
      setVoicePhase('idle');
      const u = uiRef.current;
      setError(u?.errVoiceStart || 'Error de voz.');
    }
  }, [
    voicePhase,
    loading,
    sessionEnded,
    input,
    sendMessage,
    micSupported,
    primeSpeechSynthesisFromUserGesture,
    stopRecognition,
    speechRecLang,
    clearVoiceSilenceTimer,
  ]);

  const nuevaConsulta = useCallback(() => {
    stopRecognition({ hard: true });
    try {
      window.speechSynthesis?.cancel?.();
    } catch {
      /* ignore */
    }
    setTtsPlaying(false);
    setDispSlotsFranja(null);
    setMessages([]);
    setInput('');
    setError('');
    setSessionEnded(false);
    setLastReserve(null);
    setSedeContextoTurno(null);
    setWhatsappEscalada(null);
    setVoiceFinal('');
    setVoiceInterim('');
    setVoiceNotice('');
  }, [stopRecognition]);

  if (!visible) return null;

  return (
    <>
      <div
        key={isPublicLanding ? `public-attention-${publicAttentionCycle}` : 'chatbot-fab'}
        className={`chatbot-fab-anchor${isPublicLanding ? ' chatbot-fab-anchor--public' : ''}`}
        style={{
          bottom: fabBottom,
        }}
      >
        <button
          type="button"
          aria-label={ui.fabOpen}
          onClick={openChatFromFab}
          style={
            fabCollapsed
              ? {
                  pointerEvents: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                }
              : {
                  pointerEvents: 'auto',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--accent)',
                  color: '#fff',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                  borderRadius: 28,
                  width: 280,
                  height: 'auto',
                  minHeight: 48,
                  padding: '10px 16px 10px 10px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  overflow: 'hidden',
                }
          }
        >
          {fabCollapsed ? (
            <>
              <span className="chatbot-fab-circle-btn">
                <ChiviFabAvatar fill src={chiviAvatarUrl} />
                {isPublicLanding ? <span className="chatbot-public-ai-spark" aria-hidden="true">✦</span> : null}
              </span>
              <span
                className={isPublicLanding ? 'chatbot-public-ai-label' : undefined}
                style={{
                  color: '#fff',
                  background: 'var(--accent)',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '3px 10px',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {ui.fabCollapsed}
              </span>
            </>
          ) : (
            <>
              <ChiviFabAvatar size={36} src={chiviAvatarUrl} />
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{ui.fabLine1}</span>
                <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, lineHeight: 1.25, marginTop: 2, whiteSpace: 'nowrap' }}>
                  {ui.fabLine2}
                </span>
              </span>
            </>
          )}
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ui.titulo}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10060,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '12px 12px max(12px, env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              stopRecognition({ hard: true });
              setOpen(false);
            }
          }}
        >
          <div
            className={theme === 'dark' ? 'chatbotia-modal--dark' : undefined}
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: 'min(88vh, 640px)',
              background: c.panelBg,
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>
              {`
                @keyframes chatbotia-mic-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
                  50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
                }
                .chatbotia-mic-recording {
                  background: #ef4444 !important;
                  border-color: #fecaca !important;
                  color: #fff !important;
                  animation: chatbotia-mic-pulse 1.15s ease-in-out infinite;
                }
                @keyframes chatbotia-voice-bar {
                  0%, 100% { transform: scaleY(0.35); opacity: 0.65; }
                  50% { transform: scaleY(1); opacity: 1; }
                }
                .chatbotia-voice-bars {
                  display: flex;
                  align-items: flex-end;
                  justify-content: center;
                  gap: 3px;
                  height: 22px;
                  margin-bottom: 6px;
                }
                .chatbotia-voice-bars span {
                  display: block;
                  width: 4px;
                  height: 18px;
                  border-radius: 2px;
                  background: #e11b22;
                  transform-origin: bottom center;
                  animation: chatbotia-voice-bar 0.55s ease-in-out infinite;
                }
                .chatbotia-voice-bars span:nth-child(1) { animation-delay: 0ms; }
                .chatbotia-voice-bars span:nth-child(2) { animation-delay: 90ms; }
                .chatbotia-voice-bars span:nth-child(3) { animation-delay: 180ms; }
                .chatbotia-voice-bars span:nth-child(4) { animation-delay: 120ms; }
                .chatbotia-voice-bars span:nth-child(5) { animation-delay: 60ms; }
                .chatbotia-modal--dark input::placeholder {
                  color: #9ca3af;
                  opacity: 1;
                }
                .chatbotia-modal--dark input {
                  caret-color: #ffffff;
                }
              `}
            </style>
            <div
              style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${c.borderHairline}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                background: c.headerBg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <ChiviFabAvatar size={36} src={chiviAvatarUrl} />
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: 16,
                    color: c.titleColor,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ui.titulo}
                </span>
                <span
                  aria-hidden
                  title={t('chatbot.online')}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4caf50',
                    flexShrink: 0,
                    marginLeft: 2,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  stopRecognition({ hard: true });
                  setOpen(false);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: c.closeColor,
                  padding: 4,
                  flexShrink: 0,
                }}
                aria-label={ui.cerrar}
              >
                ×
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 200,
                background: c.scrollBg,
              }}
            >
              {messages.length === 0 ? (
                <div style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '100%' }}>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: c.welcomeBg,
                      color: c.welcomeColor,
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {(() => {
                      const base = ui.welcomeAssistant(chatWelcomeFirstName);
                      const hasPrefs = hasDeportesPreferidosCargados(userProfile?.deportes_preferidos);
                      const hint =
                        session?.user && !hasPrefs && ui.welcomeDeportesHint
                          ? `\n\n${ui.welcomeDeportesHint}`
                          : '';
                      return base + hint;
                    })()}
                  </div>
                </div>
              ) : null}
              {showQuickSuggestionBar && messages.length === 0 ? (
                <QuickSuggestionBar
                  items={ui.quickSuggestions}
                  disabled={loading || sessionEnded}
                  onPick={handleQuickSuggestion}
                  isDark={theme === 'dark'}
                />
              ) : null}
              {messages.map((m, i) => (
                <React.Fragment key={`${i}-${m.role}`}>
                  <div
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '92%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: m.role === 'user' ? c.userBg : c.assistantBg,
                      color: m.role === 'user' ? c.userColor : c.assistantColor,
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' &&
                  Array.isArray(m.disponibilidad?.deportes_eleccion) &&
                  m.disponibilidad.deportes_eleccion.length ? (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        maxWidth: '92%',
                        marginTop: -2,
                        marginBottom: 2,
                        padding: '0 2px 8px',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.secondaryLabel, marginBottom: 6 }}>
                        {ui.deportesElegirTitulo}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {m.disponibilidad.deportes_eleccion.map((slug) => (
                          <button
                            key={`${i}-dep-${slug}`}
                            type="button"
                            disabled={loading || sessionEnded}
                            onClick={() => void sendMessage(slug)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: `1px solid ${c.chipBorder}`,
                              background: c.chipBg,
                              color: c.chipColor,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: loading || sessionEnded ? 'not-allowed' : 'pointer',
                              opacity: loading || sessionEnded ? 0.55 : 1,
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            <SportIcon deporte={slug} size={16} color={c.chipColor} />
                            {ui.deporteElegirLabel(slug)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {m.role === 'assistant' && m.disponibilidad?.slots?.length ? (() => {
                    const disp = m.disponibilidad;
                    const slots = disp.slots;
                    const n = slots.length;
                    const groups = groupDisponibilidadSlotsByFranja(slots);
                    const keysWithSlots = FRANJA_KEYS.filter((k) => groups[k].length > 0);
                    const useFranjaNav =
                      n > DISPO_SLOTS_FRANJA_THRESHOLD && keysWithSlots.length > 1;
                    const franjaAbierta =
                      dispSlotsFranja?.messageIndex === i ? dispSlotsFranja.franja : null;
                    const listado = useFranjaNav
                      ? franjaAbierta
                        ? groups[franjaAbierta]
                        : []
                      : slots;

                    return (
                      <div
                        style={{
                          alignSelf: 'flex-start',
                          maxWidth: '92%',
                          marginTop: -2,
                          marginBottom: 2,
                          padding: '0 2px 8px',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.secondaryLabel, marginBottom: 6 }}>
                          {ui.slotsDisponiblesTitulo}
                        </div>
                        {useFranjaNav ? (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 6,
                              marginBottom: listado.length ? 6 : 0,
                            }}
                          >
                            {keysWithSlots.map((k) => {
                              const active = franjaAbierta === k;
                              const label =
                                k === 'manana' ? ui.franjaManana : k === 'tarde' ? ui.franjaTarde : ui.franjaNoche;
                              return (
                                <button
                                  key={`${i}-franja-${k}`}
                                  type="button"
                                  onClick={() =>
                                    setDispSlotsFranja((prev) =>
                                      prev?.messageIndex === i && prev?.franja === k
                                        ? null
                                        : { messageIndex: i, franja: k },
                                    )
                                  }
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: active ? `2px solid ${c.franjaBorderActive}` : `1px solid ${c.franjaBorderInactive}`,
                                    background: active ? c.franjaActiveBg : c.franjaInactiveBg,
                                    color: c.franjaText,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    WebkitTapHighlightColor: 'transparent',
                                  }}
                                >
                                  {label}{' '}
                                  <span style={{ color: c.franjaCount, fontWeight: 700 }}>({groups[k].length})</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {listado.map((s, j) => {
                            const sid = disp.sede_id;
                            const fe = disp.fecha;
                            const det = Array.isArray(s.canchas_detalle) ? s.canchas_detalle : [];
                            const nLibresRaw = Number(s.canchas_libres);
                            const nLibres =
                              Number.isFinite(nLibresRaw) && nLibresRaw > 0
                                ? nLibresRaw
                                : Math.max(1, det.length);
                            const hora = String(s.hora_inicio || '').trim();
                            const chipText = hora ? `${hora} · ${nLibres}` : String(nLibres);
                            const cancha = det[0] || null;
                            const canchaId = cancha?.numero != null ? String(cancha.numero) : '';
                            const href = buildVoiceBookingCheckoutHref({
                              sedeId: sid,
                              fecha: fe,
                              hora: s.hora_inicio,
                              canchaId,
                              deporte: disp.deporte_filtro,
                            });
                            return (
                              <button
                                key={`${i}-slot-${String(s.hora_inicio || '')}-${j}`}
                                type="button"
                                disabled={!href}
                                onClick={() => {
                                  if (!href) return;
                                  setVoiceBookingSelection({
                                    sedeId: sid,
                                    sedeNombre: disp.sede_nombre || ui.limiteCtaVerSede,
                                    fecha: fe,
                                    hora,
                                    canchaNombre: String(cancha?.nombre || '').trim() || `Cancha ${canchaId || ''}`.trim(),
                                    href,
                                  });
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '5px 9px',
                                  borderRadius: 8,
                                  background: c.slotBg,
                                  color: c.slotColor,
                                  fontWeight: 700,
                                  fontSize: 12,
                                  border: `0.5px solid ${c.slotBorder}`,
                                  whiteSpace: 'nowrap',
                                  cursor: href ? 'pointer' : 'not-allowed',
                                  opacity: href ? 1 : 0.55,
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                              >
                                {chipText}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })() : null}
                  {m.role === 'assistant' && showQuickSuggestionBar && i === lastAssistantIndex ? (
                    <QuickSuggestionBar
                      items={ui.quickSuggestions}
                      disabled={loading || sessionEnded}
                      onPick={handleQuickSuggestion}
                      isDark={theme === 'dark'}
                    />
                  ) : null}
                </React.Fragment>
              ))}
              {loading ? (
                <div style={{ color: c.loadingColor, fontSize: 13, fontWeight: 600 }}>{ui.escribiendo}</div>
              ) : null}
              {!sessionEnded && voiceBookingSelection?.href ? (
                <div
                  style={{
                    alignSelf: 'stretch',
                    margin: '4px 2px 8px',
                    padding: 14,
                    border: `1px solid ${c.reservaCtaBg}`,
                    borderRadius: 12,
                    background: c.slotBg,
                  }}
                >
                  <div style={{ color: c.assistantColor, fontWeight: 850, fontSize: 14, marginBottom: 6 }}>
                    {ui.confirmarTurnoTitulo}
                  </div>
                  <div style={{ color: c.secondaryLabel, fontSize: 13, lineHeight: 1.45 }}>
                    {ui.confirmarTurnoDetalle(
                      voiceBookingSelection.sedeNombre,
                      voiceBookingSelection.canchaNombre,
                      voiceBookingSelection.fecha,
                      voiceBookingSelection.hora,
                    )}
                  </div>
                  <div style={{ color: c.secondaryLabel, fontSize: 12, lineHeight: 1.45, marginTop: 8 }}>
                    {ui.confirmarTurnoAviso}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const selectedHref = voiceBookingSelection.href;
                        setVoiceBookingSelection(null);
                        setOpen(false);
                        navigate(selectedHref);
                      }}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 9,
                        background: c.reservaCtaBg,
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        border: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {ui.confirmarTurnoCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceBookingSelection(null)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 9,
                        border: `1px solid ${c.chipBorder}`,
                        background: 'transparent',
                        color: c.secondaryLabel,
                        fontWeight: 750,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {ui.cancelarTurnoCta}
                    </button>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div style={{ color: c.errorColor, fontSize: 13, fontWeight: 600 }}>{error}</div>
              ) : null}
              {sessionEnded ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: c.sessionBoxBg,
                    border: `1px solid ${c.sessionBoxBorder}`,
                    color: c.sessionBoxText,
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ marginBottom: 12, lineHeight: 1.45 }}>{ui.limiteSesion}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Link
                      to={limiteSesionCta.href}
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: c.limitePrimaryCta,
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 15,
                        textDecoration: 'none',
                        textAlign: 'center',
                      }}
                    >
                      {limiteSesionCta.href === '/jugar'
                        ? ui.limiteCtaJugar
                        : limiteSesionCta.nombre
                          ? ui.verSedePrimario(limiteSesionCta.nombre)
                          : ui.limiteCtaVerSede}
                    </Link>
                    <button
                      type="button"
                      onClick={nuevaConsulta}
                      style={{
                        border: `1px solid ${c.nuevaConsultaBorder}`,
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        background: c.nuevaConsultaBg,
                        color: c.nuevaConsultaText,
                        fontSize: 14,
                      }}
                    >
                      {ui.nuevaConsultaSesion}
                    </button>
                  </div>
                </div>
              ) : null}
              {!sessionEnded && lastReserve?.href ? (
                <Link
                  to={lastReserve.href}
                  onClick={() => setOpen(false)}
                  title={lastReserve.fecha || lastReserve.hora ? [lastReserve.fecha, lastReserve.hora].filter(Boolean).join(' · ') : ui.reservaLinkTitle}
                  style={{
                    alignSelf: 'center',
                    marginTop: 4,
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: c.reservaCtaBg,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  {ui.reservaLink}
                  {lastReserve.hora
                    ? ` · ${lastReserve.hora}${lastReserve.fecha ? ` (${lastReserve.fecha})` : ''}`
                    : lastReserve.fecha
                      ? ` · ${lastReserve.fecha}`
                      : ''}
                </Link>
              ) : null}
              {!sessionEnded && whatsappEscalada?.href ? (
                <a
                  href={whatsappEscalada.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    alignSelf: 'center',
                    marginTop: 4,
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: c.waEscalada,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  {ui.waEscalada}
                  {whatsappEscalada.sede_nombre ? ` · ${whatsappEscalada.sede_nombre}` : ''}
                </a>
              ) : null}
              <div ref={listEndRef} />
            </div>

            <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${c.footerTopBorder}`, background: c.panelBg }}>
              {ttsSupported ? (
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: c.readAloudColor }}
                >
                  <input
                    type="checkbox"
                    checked={readAloud}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setReadAloud(v);
                      if (v) primeSpeechSynthesisFromUserGesture();
                      if (!v) {
                        try {
                          window.speechSynthesis?.cancel?.();
                        } catch {
                          /* ignore */
                        }
                        setTtsPlaying(false);
                      }
                    }}
                  />
                  {ui.leerVozAlta}
                </label>
              ) : null}
              {ttsSupported && ttsPlaying ? (
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.speechSynthesis?.cancel?.();
                      } catch {
                        /* ignore */
                      }
                      setTtsPlaying(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${c.stopTtsBorder}`,
                      background: c.stopTtsBg,
                      color: c.stopTtsColor,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {ui.ttsDetener}
                  </button>
                </div>
              ) : null}
              {ttsSupported && isLikelyIOSWebKit && readAloud && lastAssistantText ? (
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      primeSpeechSynthesisFromUserGesture();
                      speakAssistantReply(lastAssistantText);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${c.iosTapBorder}`,
                      background: c.iosTapBg,
                      color: c.iosTapColor,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {ui.escucharUltimaIos}
                  </button>
                  <div style={{ marginTop: 4, fontSize: 11, color: c.hintIos, lineHeight: 1.35 }}>
                    {ui.hintIosSafari}
                  </div>
                </div>
              ) : null}
              {voicePhase === 'listening' ? (
                <div className="chatbotia-voice-bars" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
              <div
                style={{
                  display: 'grid',
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  gap: 8,
                  alignItems: 'center',
                  gridTemplateColumns: (() => {
                    if (voicePhase === 'listening') {
                      return micSupported ? 'minmax(0, 1fr) 44px' : 'minmax(0, 1fr)';
                    }
                    return micSupported ? 'minmax(0, 1fr) 44px auto' : 'minmax(0, 1fr) auto';
                  })(),
                }}
              >
                {voicePhase === 'listening' ? (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-relevant="additions text"
                    style={{
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${c.dictationBorder}`,
                      fontSize: 16,
                      minHeight: 44,
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      background: c.dictationBg,
                    }}
                  >
                    <span style={{ color: c.dictationSolid, whiteSpace: 'pre-wrap' }}>{voiceFinal}</span>
                    <span style={{ color: c.dictationInterim, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                      {voiceInterim}
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage(input);
                      }
                    }}
                    disabled={loading || sessionEnded || voicePhase === 'processing'}
                    placeholder={sessionEnded ? '—' : ui.placeholder}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      padding: '10px 16px',
                      borderRadius: 99,
                      border: `1px solid ${c.inputBorder}`,
                      fontSize: 16,
                      lineHeight: 1.25,
                      minHeight: 44,
                      WebkitTapHighlightColor: 'transparent',
                      background: c.inputBg,
                      color: c.inputColor,
                    }}
                  />
                )}
                {micSupported ? (
                  <button
                    type="button"
                    aria-label={
                      voicePhase === 'listening'
                        ? ui.micRecordingAria
                        : voicePhase === 'processing'
                          ? ui.micProcessingAria
                          : ui.micDictateAria
                    }
                    aria-pressed={voicePhase === 'listening'}
                    disabled={loading || sessionEnded || voicePhase === 'processing'}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startVoice();
                    }}
                    className={voicePhase === 'listening' ? 'chatbotia-mic-recording' : ''}
                    style={{
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      maxWidth: 44,
                      minHeight: 44,
                      maxHeight: 44,
                      padding: 0,
                      margin: 0,
                      justifySelf: 'center',
                      boxSizing: 'border-box',
                      borderRadius: 10,
                      border: `1px solid ${c.micBorder}`,
                      background: c.micBg,
                      color: c.inputColor,
                      fontSize: 22,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor:
                        loading || sessionEnded || voicePhase === 'processing' ? 'not-allowed' : 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    <TablerMicrophoneIcon size={22} />
                  </button>
                ) : null}
                {voicePhase !== 'listening' ? (
                  <button
                    type="button"
                    disabled={
                      loading ||
                      sessionEnded ||
                      voicePhase === 'listening' ||
                      voicePhase === 'processing' ||
                      !input.trim()
                    }
                    onClick={() => void sendMessage(input)}
                    style={{
                      justifySelf: 'end',
                      whiteSpace: 'nowrap',
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: 'none',
                      fontSize: 15,
                      background:
                        loading ||
                        sessionEnded ||
                        voicePhase === 'listening' ||
                        voicePhase === 'processing' ||
                        !input.trim()
                          ? '#94a3b8'
                          : '#E11B22',
                      color: '#fff',
                      fontWeight: 800,
                      cursor:
                        loading ||
                        sessionEnded ||
                        voicePhase === 'listening' ||
                        voicePhase === 'processing' ||
                        !input.trim()
                          ? 'not-allowed'
                          : 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    {ui.enviar}
                  </button>
                ) : null}
              </div>
              {(voicePhase === 'listening' || voicePhase === 'processing') && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: c.voiceStatus }}
                >
                  {voicePhase === 'listening' ? ui.escuchando : ui.procesando}
                </div>
              )}
              {voiceNotice ? (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: c.voiceNotice }}>{voiceNotice}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
