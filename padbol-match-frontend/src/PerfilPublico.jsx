import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { nombreCompletoJugadorPerfil } from './utils/jugadorPerfil';
import { normalizeEmailStr } from './utils/jugadorNombreTorneo';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

function instagramHandleFromStored(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname.toLowerCase().includes('instagram.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[0] ? String(parts[0]).replace(/\/$/, '') : '';
      }
    } catch {
      return '';
    }
  }
  return s.replace(/^@/, '').trim();
}

const CATEGORIA_COLOR = {
  Principiante: '#78909c',
  '5ta': '#43a047',
  '4ta': '#039be5',
  '3ra': '#8e24aa',
  '2da': '#e53935',
  '1ra': '#f57c00',
  Elite: '#212121',
};

function normalizeJugadorEquipo(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    id: p.id != null && p.id !== '' ? String(p.id) : null,
    email: String(p.email || '').trim().toLowerCase(),
    alias: String(p.alias || '').trim().toLowerCase(),
    nombre: String(p.nombre || '').trim().toLowerCase(),
  };
}

/** Igualdad de ids entre JSON de equipo y `perfil.user_id` (string vs número en JSON). */
function idsJugadorEquipoCoinciden(idJson, userIdPerfil) {
  const a = idJson != null && idJson !== '' ? String(idJson).trim() : '';
  const b = userIdPerfil != null && String(userIdPerfil).trim() !== '' ? String(userIdPerfil).trim() : '';
  return Boolean(a && b && a === b);
}

function jugadorEnEquipo(jugadoresArr, perfil) {
  if (!Array.isArray(jugadoresArr) || !perfil) return false;
  const uid = String(perfil.user_id || '').trim();
  const em = normalizeEmailStr(perfil.email);
  const rawEm = String(perfil.email || '').trim().toLowerCase();
  const al = String(perfil.alias || '').trim().toLowerCase();
  const nomFull = String(nombreCompletoJugadorPerfil(perfil) || perfil.nombre || '')
    .trim()
    .toLowerCase();

  for (const raw of jugadoresArr) {
    const p = normalizeJugadorEquipo(raw);
    if (!p) continue;
    if (uid && p.id && idsJugadorEquipoCoinciden(p.id, uid)) return true;
    if (em && p.email && p.email === em) return true;
    if (rawEm && p.email && p.email === rawEm) return true;
    if (al && p.alias && p.alias === al) return true;
    if (nomFull && p.nombre && p.nombre === nomFull) return true;
  }
  return false;
}

/** Torneos en los que el jugador figura (jugadores_torneo o equipos). */
async function torneoIdsJugadosPorPerfil(perfil) {
  const uid = perfil?.user_id != null && String(perfil.user_id).trim() !== '' ? String(perfil.user_id).trim() : '';
  const emailPerfil = perfil?.email != null ? String(perfil.email).trim() : '';
  const em = normalizeEmailStr(perfil?.email || '');
  const rawEmLower = emailPerfil.toLowerCase();
  const played = new Set();

  const debug = {
    'perfil.user_id': uid || null,
    'perfil.email (raw)': emailPerfil || null,
    'perfil.email (normalizado)': em || null,
    jugadoresTorneoFilas: 0,
    equiposPorContainsId: 0,
    equiposPorContainsEmailNorm: 0,
    equiposPorContainsEmailRaw: 0,
    equiposPorIlikeJugadores: 0,
  };

  if (em) {
    const { data: jt } = await supabase.from('jugadores_torneo').select('torneo_id').ilike('email', em);
    const rows = jt || [];
    debug.jugadoresTorneoFilas = rows.length;
    rows.forEach((r) => {
      if (r.torneo_id != null) played.add(r.torneo_id);
    });
  }

  const mergeEq = (list) => {
    (list || []).forEach((r) => {
      if (r.torneo_id != null) played.add(r.torneo_id);
    });
  };

  /** Equipos: primero `perfil.user_id` en JSON `jugadores[].id`; si no hay filas, `perfil.email` en `jugadores[].email`. */
  if (uid) {
    const { data, error } = await supabase.from('equipos').select('torneo_id').contains('jugadores', [{ id: uid }]);
    if (error) console.warn('[PerfilPublico] equipos contains id', error);
    const rows = data || [];
    debug.equiposPorContainsId = rows.length;
    mergeEq(rows);
  }

  if (em) {
    const { data, error } = await supabase.from('equipos').select('torneo_id').contains('jugadores', [{ email: em }]);
    if (error) console.warn('[PerfilPublico] equipos contains email norm', error);
    const rows = data || [];
    debug.equiposPorContainsEmailNorm = rows.length;
    mergeEq(rows);
  }

  if (emailPerfil && rawEmLower !== em) {
    const { data, error } = await supabase
      .from('equipos')
      .select('torneo_id')
      .contains('jugadores', [{ email: rawEmLower }]);
    if (error) console.warn('[PerfilPublico] equipos contains email raw lower', error);
    const rows = data || [];
    debug.equiposPorContainsEmailRaw = rows.length;
    mergeEq(rows);
  }

  /** Respaldo: texto JSON contiene email o user_id (mayúsculas / espacios en JSON). */
  const needlesIlike = [...new Set([em, uid, emailPerfil].filter(Boolean))];
  let ilikeFilasTotal = 0;
  for (const needle of needlesIlike) {
    const esc = String(needle).replace(/%/g, '\\%').replace(/_/g, '\\_');
    const { data, error } = await supabase
      .from('equipos')
      .select('torneo_id')
      .filter('jugadores', 'ilike', `%${esc}%`);
    if (error) {
      console.warn('[PerfilPublico] equipos ilike jugadores (opcional)', needle, error);
    } else {
      const rows = data || [];
      ilikeFilasTotal += rows.length;
      mergeEq(rows);
    }
  }
  debug.equiposPorIlikeJugadores = ilikeFilasTotal;

  const playedArr = [...played].filter((x) => x != null);
  console.log('[PerfilPublico] estadísticas debug', {
    ...debug,
    torneoIdsResultantes: playedArr,
    cantidadTorneos: playedArr.length,
  });

  return playedArr;
}

/**
 * Suma **todos** los `puntos` en `tabla_puntos` del jugador (coincidencia por `user_id` o `email` en `equipos.jugadores`),
 * sin filtrar por sede, nivel ni torneo.
 */
async function sumarPuntosTablaPuntosGlobalJugador(perfil) {
  const PAGE = 800;
  let offset = 0;
  let total = 0;
  let filasEvaluadas = 0;
  let filasSumadas = 0;
  const eqCache = new Map();

  while (true) {
    const { data: tpRows, error } = await supabase
      .from('tabla_puntos')
      .select('equipo_id, puntos')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error('[PerfilPublico] suma global tabla_puntos', error);
      break;
    }
    if (!tpRows?.length) break;

    const eqIds = [...new Set(tpRows.map((r) => r.equipo_id).filter(Boolean))];
    const eqIdsNuevos = eqIds.filter((id) => !eqCache.has(id));
    if (eqIdsNuevos.length) {
      const { data: eqRows, error: errEq } = await supabase
        .from('equipos')
        .select('id, jugadores')
        .in('id', eqIdsNuevos);
      if (errEq) {
        console.error('[PerfilPublico] equipos (suma global)', errEq);
      } else {
        (eqRows || []).forEach((e) => {
          eqCache.set(e.id, e);
        });
      }
    }

    for (const pr of tpRows) {
      filasEvaluadas += 1;
      const eq = eqCache.get(pr.equipo_id);
      if (eq && jugadorEnEquipo(eq.jugadores, perfil)) {
        total += Number(pr.puntos) || 0;
        filasSumadas += 1;
      }
    }

    if (tpRows.length < PAGE) break;
    offset += PAGE;
  }

  console.log('[PerfilPublico] puntos totales (tabla_puntos global)', {
    total,
    filasEvaluadas,
    filasSumadas,
    'perfil.user_id': perfil?.user_id ?? null,
    'perfil.email': perfil?.email ?? null,
  });

  return total;
}

/**
 * Torneos jugados, puntos totales (suma global en `tabla_puntos`) y últimos 3 torneos con posición/puntos (según torneos detectados).
 */
async function fetchEstadisticasYUltimosTorneos(perfil) {
  const [puntosTotales, playedArr] = await Promise.all([
    sumarPuntosTablaPuntosGlobalJugador(perfil),
    torneoIdsJugadosPorPerfil(perfil),
  ]);

  if (!playedArr.length) {
    console.log('[PerfilPublico] estadísticas debug', {
      fase: 'sin torneos detectados',
      motivo: 'playedArr vacío',
      puntosTotales,
      playedArr,
    });
    return { torneosJugados: 0, puntosTotales, ultimosTorneos: [] };
  }

  const { data: puntosRows, error: errPuntos } = await supabase
    .from('tabla_puntos')
    .select('torneo_id, equipo_id, posicion, puntos')
    .in('torneo_id', playedArr);

  if (errPuntos) {
    console.error('[PerfilPublico] tabla_puntos', errPuntos);
    console.log('[PerfilPublico] estadísticas debug', { fase: 'error tabla_puntos', errPuntos, playedArrLen: playedArr.length });
    return { torneosJugados: playedArr.length, puntosTotales, ultimosTorneos: [] };
  }

  const eqIds = [...new Set((puntosRows || []).map((r) => r.equipo_id).filter(Boolean))];
  if (!eqIds.length) {
    console.log('[PerfilPublico] estadísticas debug', {
      fase: 'sin tabla_puntos en torneos detectados',
      playedArrLen: playedArr.length,
      filasTablaPuntosQuery: (puntosRows || []).length,
      puntosTotales,
    });
    return { torneosJugados: playedArr.length, puntosTotales, ultimosTorneos: [] };
  }

  const { data: eqRows, error: errEq } = await supabase
    .from('equipos')
    .select('id, jugadores, torneo_id')
    .in('id', eqIds);

  if (errEq) {
    console.error('[PerfilPublico] equipos tabla_puntos', errEq);
    return { torneosJugados: playedArr.length, puntosTotales, ultimosTorneos: [] };
  }

  const eqMap = {};
  (eqRows || []).forEach((e) => {
    eqMap[e.id] = e;
  });

  const misFilas = [];
  for (const pr of puntosRows || []) {
    const eq = eqMap[pr.equipo_id];
    if (!eq || !jugadorEnEquipo(eq.jugadores, perfil)) continue;
    misFilas.push({
      torneo_id: pr.torneo_id,
      posicion: pr.posicion,
      puntos: pr.puntos,
    });
  }

  const porTorneo = new Map();
  for (const row of misFilas) {
    if (!porTorneo.has(row.torneo_id)) porTorneo.set(row.torneo_id, row);
  }
  const unique = [...porTorneo.values()];
  const tids = [...new Set(unique.map((u) => u.torneo_id))];

  const { data: torneos } = await supabase
    .from('torneos')
    .select('id, nombre, updated_at, created_at')
    .in('id', tids);

  const torneoMeta = {};
  (torneos || []).forEach((t) => {
    torneoMeta[t.id] = t;
  });

  const enriched = unique.map((u) => {
    const meta = torneoMeta[u.torneo_id];
    const nom = String(meta?.nombre || '').trim();
    return {
      nombre: nom || `Torneo #${u.torneo_id}`,
      posicion: u.posicion,
      puntos: u.puntos,
      sortKey: String(meta?.updated_at || meta?.created_at || ''),
      idNum: Number(u.torneo_id) || 0,
    };
  });

  enriched.sort((a, b) => {
    const da = Date.parse(a.sortKey) || 0;
    const db = Date.parse(b.sortKey) || 0;
    if (db !== da) return db - da;
    return b.idNum - a.idNum;
  });

  const ultimosTorneos = enriched.slice(0, 3).map(({ nombre, posicion, puntos }) => ({
    nombre,
    posicion,
    puntos,
  }));

  console.log('[PerfilPublico] estadísticas debug', {
    fase: 'resultado',
    torneosJugados: playedArr.length,
    filasTablaPuntosEnTorneosDetectados: (puntosRows || []).length,
    equiposIdsEnPuntos: eqIds.length,
    equiposFilasCargadas: (eqRows || []).length,
    filasPuntosAsignadasAlJugadorUltimosTorneos: misFilas.length,
    puntosTotales,
    nota: 'puntosTotales = suma global tabla_puntos (solo filtro jugador)',
    ultimosTorneosCount: ultimosTorneos.length,
  });

  return { torneosJugados: playedArr.length, puntosTotales, ultimosTorneos };
}

async function fetchRankingLocalPosicion(perfil) {
  const sid = perfil?.sede_id;
  if (sid == null || sid === '') return null;
  const em = normalizeEmailStr(perfil.email || '');
  const nombreLower = String(perfil.nombre || '').trim().toLowerCase();

  try {
    const params = new URLSearchParams({ scope: 'local', sede_id: String(sid) });
    const res = await fetch(`${apiUrl('/api/rankings')}?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) return null;
    const idx = data.findIndex((p) => {
      const pe = String(p.email || '').trim().toLowerCase();
      if (em && pe === em) return true;
      if (!p.email && nombreLower && String(p.nombre || '').trim().toLowerCase() === nombreLower) return true;
      return false;
    });
    return idx >= 0 ? idx + 1 : null;
  } catch {
    return null;
  }
}

const wrap = {
  maxWidth: '520px',
  width: '100%',
  margin: '0 auto',
  padding: '20px',
  boxSizing: 'border-box',
};

export default function PerfilPublico() {
  const { alias: aliasParam } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  /** `null` = sin ids; `{ kind, row }` con fila del otro jugador (o `row: null` si no se encontró). */
  const [companeroDisplay, setCompaneroDisplay] = useState(null);
  const [stats, setStats] = useState({ torneosJugados: null, puntosTotales: null });
  const [ultimosTorneos, setUltimosTorneos] = useState([]);
  const [rankingPos, setRankingPos] = useState(null);

  const aliasDecoded = useMemo(() => {
    try {
      return decodeURIComponent(String(aliasParam || '').trim());
    } catch {
      return String(aliasParam || '').trim();
    }
  }, [aliasParam]);

  const load = useCallback(async () => {
    const a = aliasDecoded;
    if (!a) {
      setPerfil(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPerfil(null);
    setCompaneroDisplay(null);
    setStats({ torneosJugados: null, puntosTotales: null });
    setUltimosTorneos([]);
    setRankingPos(null);

    const { data: rows, error } = await supabase.from('jugadores_perfil').select('*').ilike('alias', a).limit(8);

    console.log('[PerfilPublico] jugadores_perfil respuesta', { error, rows, rowCount: Array.isArray(rows) ? rows.length : 0 });

    if (error) {
      console.error('[PerfilPublico]', error);
      setPerfil(null);
      setLoading(false);
      return;
    }
    const list = Array.isArray(rows) ? rows : [];
    const aLower = a.toLowerCase();
    const match =
      list.find((r) => String(r.alias || '').trim().toLowerCase() === aLower) ||
      (list.length === 1 ? list[0] : null);

    if (!match) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    console.log('[PerfilPublico] jugadores_perfil fila usada', match);

    setPerfil(match);

    const cid = match.companero_id != null ? String(match.companero_id).trim() : '';
    const uid = match.ultimo_companero_id != null ? String(match.ultimo_companero_id).trim() : '';
    if (cid) {
      const { data: comp } = await supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .eq('user_id', cid)
        .maybeSingle();
      setCompaneroDisplay({ kind: 'habitual', row: comp || null });
    } else if (uid) {
      const { data: comp } = await supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .eq('user_id', uid)
        .maybeSingle();
      setCompaneroDisplay({ kind: 'ultimo', row: comp || null });
    } else {
      setCompaneroDisplay(null);
    }

    try {
      const s = await fetchEstadisticasYUltimosTorneos(match);
      setStats({ torneosJugados: s.torneosJugados, puntosTotales: s.puntosTotales });
      setUltimosTorneos(Array.isArray(s.ultimosTorneos) ? s.ultimosTorneos : []);
    } catch (e) {
      console.error('[PerfilPublico] stats', e);
      setStats({ torneosJugados: 0, puntosTotales: 0 });
      setUltimosTorneos([]);
    }

    try {
      const pos = await fetchRankingLocalPosicion(match);
      setRankingPos(pos);
    } catch {
      setRankingPos(null);
    }

    setLoading(false);
  }, [aliasDecoded]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !perfil) return;
    const ciudadClub = perfil.ciudad;
    const localidad = perfil.localidad;
    const nivelCat = perfil.nivel;
    const foto = perfil.foto_url;
    const instagram = perfil.instagram_url;
    const federado = perfil.es_federado;
    const pendVal = perfil.pendiente_validacion;
    const ciudadTrim = perfil.ciudad != null ? String(perfil.ciudad).trim() : '';
    const localidadTrimLog = perfil.localidad != null ? String(perfil.localidad).trim() : '';
    const nivelTxt =
      perfil.nivel != null && String(perfil.nivel) !== '' ? String(perfil.nivel) : '';
    const fotoUsable = perfil.foto_url != null && String(perfil.foto_url).trim() !== '';
    const igRaw =
      perfil.instagram_url != null && String(perfil.instagram_url) !== ''
        ? String(perfil.instagram_url)
        : '';
    let igHrefLog = '';
    if (igRaw && /^https?:\/\//i.test(igRaw)) igHrefLog = igRaw;
    else {
      const h = instagramHandleFromStored(igRaw);
      if (h) igHrefLog = `https://www.instagram.com/${encodeURIComponent(h)}/`;
    }
    console.log('[PerfilPublico] mapeo campos (verificación)', {
      'perfil.ciudad': ciudadClub,
      'UI club habitual': ciudadTrim ? `Club habitual: ${ciudadTrim}` : 'Sin definir',
      'perfil.localidad': localidad,
      'UI línea 📍 (si hay)': localidadTrimLog || '(oculta)',
      'perfil.nivel': nivelCat,
      'UI categoría (texto tal cual)': nivelTxt || '(vacío → Sin definir)',
      'perfil.pendiente_validacion': pendVal,
      'UI aviso pendiente': pendVal === true ? '(pendiente de validación)' : '(no)',
      'perfil.foto_url': foto,
      'UI muestra foto': fotoUsable,
      'perfil.instagram_url': instagram,
      'UI instagram href': igHrefLog || '(sin link)',
      'perfil.es_federado': federado,
      'UI federado': federado === true ? 'Sí' : federado === false ? 'No' : 'Sin definir',
    });
  }, [loading, perfil]);

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: 'Arial',
    paddingTop: '16px',
    paddingBottom: '32px',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingLeft: 'calc(16px + env(safe-area-inset-left, 0px))',
    paddingRight: 'calc(16px + env(safe-area-inset-right, 0px))',
  };

  const paisParts = (perfil?.pais || '').split(' ');
  const paisFlag = paisParts[0];
  const paisNombre = paisParts.slice(1).join(' ');
  /** Color chip categoría: clave por `nivel` recortado (solo para color, no sustituye el texto). */
  const nivelPerfilTrimKey = String(perfil?.nivel ?? '').trim();
  const categoriaColor = CATEGORIA_COLOR[nivelPerfilTrimKey] || '#999';
  /** Categoría en UI: valor exacto de `perfil.nivel` (string en BD), sin otra fuente. */
  const nivelPerfilTexto =
    perfil?.nivel != null && String(perfil.nivel) !== '' ? String(perfil.nivel) : '';
  const nombreCompleto = nombreCompletoJugadorPerfil(perfil) || String(perfil?.nombre || '').trim();
  const aliasGrande = String(perfil?.alias || '').trim();
  /** Instagram: solo `perfil.instagram_url`. */
  const instagramRaw =
    perfil?.instagram_url != null && String(perfil.instagram_url) !== ''
      ? String(perfil.instagram_url)
      : '';
  const instagramHref =
    instagramRaw && /^https?:\/\//i.test(instagramRaw)
      ? instagramRaw
      : (() => {
          const h = instagramHandleFromStored(instagramRaw);
          return h ? `https://www.instagram.com/${encodeURIComponent(h)}/` : '';
        })();
  /** Foto: solo `perfil.foto_url`; vacío/null → avatar por defecto. */
  const tieneFotoUrl = perfil?.foto_url != null && String(perfil.foto_url).trim() !== '';
  const fotoUrlPerfil = tieneFotoUrl ? String(perfil.foto_url).trim() : '';
  /** Club habitual: solo `perfil.ciudad`. */
  const clubCiudadTrim = perfil?.ciudad != null ? String(perfil.ciudad).trim() : '';
  const clubHabitualMostrado = clubCiudadTrim ? `Club habitual: ${clubCiudadTrim}` : 'Sin definir';
  /** Ciudad/lugar en UI: solo `perfil.localidad`. */
  const localidadTrim = perfil?.localidad != null ? String(perfil.localidad).trim() : '';
  /** Federado: solo `perfil.es_federado`. */
  const esFederadoBool = perfil?.es_federado;

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={wrap}>
          <p style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', padding: '40px 0' }}>Cargando…</p>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div style={pageStyle}>
        <div style={wrap}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              marginBottom: '16px',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            ← Volver
          </button>
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '28px 22px',
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            Jugador no encontrado
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={wrap}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            marginBottom: '14px',
            padding: '8px 0',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          ← Volver
        </button>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px 22px 22px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            marginBottom: '14px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              margin: '0 auto 10px',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 0 3px #ef4444',
              boxSizing: 'border-box',
              background: '#e2e8f0',
            }}
          >
            {fotoUrlPerfil ? (
              <img
                src={fotoUrlPerfil}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#cbd5e1',
                }}
                aria-hidden
              >
                <span style={{ fontSize: '44px', lineHeight: 1, opacity: 0.85 }}>👤</span>
              </div>
            )}
          </div>

          {aliasGrande ? (
            <>
              <h1 style={{ margin: '4px 0 4px', fontSize: '22px', fontWeight: 'bold', color: '#222' }}>{aliasGrande}</h1>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#94a3b8', fontWeight: 400 }}>{nombreCompleto || '—'}</p>
            </>
          ) : (
            <h1 style={{ margin: '4px 0 8px', fontSize: '22px', fontWeight: 'bold', color: '#222' }}>
              {nombreCompleto || 'Jugador'}
            </h1>
          )}

          {perfil.pais ? (
            <p style={{ margin: '0 0 3px', color: '#777', fontSize: '13px', textAlign: 'center', lineHeight: 1.35 }}>
              {paisFlag} <span style={{ color: '#777', fontSize: '13px' }}>{paisNombre}</span>
            </p>
          ) : null}
          {localidadTrim ? (
            <p style={{ margin: '0 0 3px', color: '#777', fontSize: '13px', textAlign: 'center', lineHeight: 1.35 }}>
              📍 {localidadTrim}
            </p>
          ) : null}

          <div
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid #eee',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div
              style={{
                padding: '8px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              {clubCiudadTrim ? (
                <span style={{ fontSize: '13px', color: '#777', fontWeight: 400 }}>{clubHabitualMostrado}</span>
              ) : (
                <span style={{ fontSize: '13px', color: '#777', fontWeight: 400 }}>Sin definir</span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                {companeroDisplay?.kind === 'ultimo' ? 'Último compañero' : 'Compañero habitual'}
              </span>
              <span style={{ fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                {companeroDisplay?.row ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    {companeroDisplay.row.foto_url ? (
                      <img
                        src={companeroDisplay.row.foto_url}
                        alt=""
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : null}
                    {String(companeroDisplay.row.alias || '').trim() ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/jugador/${encodeURIComponent(String(companeroDisplay.row.alias).trim())}`)
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: '#5b21b6',
                          fontWeight: 700,
                          textDecoration: 'underline',
                        }}
                      >
                        @{String(companeroDisplay.row.alias).trim()}
                      </button>
                    ) : (
                      <span style={{ fontWeight: 600 }}>
                        {nombreCompletoJugadorPerfil(companeroDisplay.row) ||
                          companeroDisplay.row.nombre ||
                          'Sin definir'}
                      </span>
                    )}
                  </span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Sin definir</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Categoría</span>
              <span
                style={{
                  fontSize: '14px',
                  textAlign: 'right',
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                {nivelPerfilTexto ? (
                  <>
                    <span style={{ fontWeight: 'bold', color: categoriaColor }}>{nivelPerfilTexto}</span>
                    {perfil.pendiente_validacion === true ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>(pendiente de validación)</span>
                    ) : null}
                  </>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Sin definir</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Lateralidad</span>
              <span style={{ fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                {perfil.lateralidad ? perfil.lateralidad : <span style={{ color: '#94a3b8' }}>Sin definir</span>}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Federado</span>
              <span style={{ fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                {esFederadoBool === true ? (
                  <>
                    Sí
                    {String(perfil.numero_fipa || '').trim() ? (
                      <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '6px' }}>
                        · N° {String(perfil.numero_fipa).trim()}
                      </span>
                    ) : null}
                  </>
                ) : esFederadoBool === false ? (
                  'No'
                ) : (
                  <span style={{ color: '#94a3b8' }}>Sin definir</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0 0',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Instagram</span>
              <span style={{ fontSize: '14px', textAlign: 'right' }}>
                {instagramHref ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={instagramRaw}
                    style={{
                      color: '#c026d3',
                      fontWeight: 700,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span aria-hidden>📸</span>
                    <span>Instagram</span>
                  </a>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Sin definir</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#f9f9f9',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
            marginBottom: '12px',
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: '15px', color: '#334155', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
            Estadísticas
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                flex: 1,
                minWidth: '120px',
                background: 'white',
                borderRadius: '10px',
                padding: '14px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#4f46e5' }}>
                {stats.torneosJugados != null ? stats.torneosJugados : '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>Torneos jugados</div>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: '120px',
                background: 'white',
                borderRadius: '10px',
                padding: '14px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#15803d' }}>
                {stats.puntosTotales != null ? stats.puntosTotales : '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>Puntos totales</div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#f9f9f9',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
            marginBottom: '12px',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: '15px',
              color: '#334155',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '8px',
            }}
          >
            Últimos torneos
          </h2>
          {ultimosTorneos.length === 0 ? (
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
              Aún no participó en torneos
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '12px' }}>
              {ultimosTorneos.map((t, i) => (
                <li
                  key={`${t.nombre}-${i}`}
                  style={{
                    background: 'white',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>{t.nombre}</div>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    <span style={{ fontWeight: 700 }}>Posición:</span> {t.posicion != null ? `#${t.posicion}` : '—'}
                    <span style={{ margin: '0 10px', color: '#cbd5e1' }}>|</span>
                    <span style={{ fontWeight: 700 }}>Puntos:</span> {t.puntos != null ? t.puntos : '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            background: '#f9f9f9',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '15px', color: '#334155' }}>Ranking local</h2>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
            {rankingPos != null ? `#${rankingPos}` : '—'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
            {perfil.sede_id != null && perfil.sede_id !== ''
              ? 'Según el ranking local de la sede indicada en su ficha (torneos finalizados).'
              : 'Sin sede en la ficha: no se calcula posición local.'}
          </p>
        </div>
      </div>
    </div>
  );
}
