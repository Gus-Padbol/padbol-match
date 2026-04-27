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
    if (uid && p.id && p.id === uid) return true;
    if (em && p.email && p.email === em) return true;
    if (rawEm && p.email && p.email === rawEm) return true;
    if (al && p.alias && p.alias === al) return true;
    if (nomFull && p.nombre && p.nombre === nomFull) return true;
  }
  return false;
}

async function fetchTorneoStats(perfil) {
  const uid = String(perfil.user_id || '').trim();
  const em = normalizeEmailStr(perfil.email);
  const rawEm = String(perfil.email || '').trim();
  const played = new Set();

  if (em) {
    const { data: jt } = await supabase.from('jugadores_torneo').select('torneo_id').ilike('email', em);
    (jt || []).forEach((r) => {
      if (r.torneo_id != null) played.add(r.torneo_id);
    });
  }

  const mergeEq = (list) => {
    (list || []).forEach((r) => {
      if (r.torneo_id != null) played.add(r.torneo_id);
    });
  };

  if (uid) {
    const { data } = await supabase.from('equipos').select('torneo_id').contains('jugadores', [{ id: uid }]);
    mergeEq(data);
  }
  if (em) {
    const { data } = await supabase.from('equipos').select('torneo_id').contains('jugadores', [{ email: em }]);
    mergeEq(data);
  }
  if (rawEm && rawEm.toLowerCase() !== em) {
    const { data } = await supabase
      .from('equipos')
      .select('torneo_id')
      .contains('jugadores', [{ email: rawEm.toLowerCase() }]);
    mergeEq(data);
  }

  const playedArr = [...played].filter((x) => x != null);
  if (!playedArr.length) return { torneosJugados: 0, torneosGanados: 0 };

  const { data: wins } = await supabase
    .from('tabla_puntos')
    .select('torneo_id, equipo_id')
    .eq('posicion', 1)
    .in('torneo_id', playedArr);
  const winRows = Array.isArray(wins) ? wins : [];
  if (!winRows.length) return { torneosJugados: playedArr.length, torneosGanados: 0 };

  const eqIds = [...new Set(winRows.map((w) => w.equipo_id).filter(Boolean))];
  const { data: eqRows } = await supabase.from('equipos').select('id, torneo_id, jugadores').in('id', eqIds);
  const eqMap = {};
  (eqRows || []).forEach((e) => {
    eqMap[e.id] = e;
  });

  const wonTorneos = new Set();
  for (const w of winRows) {
    const eq = eqMap[w.equipo_id];
    if (eq && jugadorEnEquipo(eq.jugadores, perfil)) wonTorneos.add(w.torneo_id);
  }

  return { torneosJugados: playedArr.length, torneosGanados: wonTorneos.size };
}

async function fetchRankingLocalPosicion(perfil) {
  const sid = perfil?.sede_id;
  if (sid == null || sid === '') return null;
  const em = normalizeEmailStr(perfil.email);
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

function Badge({ text, color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        color: 'white',
        background: color,
      }}
    >
      {text}
    </span>
  );
}

export default function PerfilPublico() {
  const { alias: aliasParam } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  /** `null` = sin ids; `{ kind, row }` con fila del otro jugador (o `row: null` si no se encontró). */
  const [companeroDisplay, setCompaneroDisplay] = useState(null);
  const [stats, setStats] = useState({ torneosJugados: null, torneosGanados: null });
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
    setStats({ torneosJugados: null, torneosGanados: null });
    setRankingPos(null);

    const { data: rows, error } = await supabase
      .from('jugadores_perfil')
      .select(
        'user_id, email, nombre, alias, foto_url, pais, ciudad, nivel, lateralidad, instagram_url, companero_id, ultimo_companero_id, sede_id'
      )
      .ilike('alias', a)
      .limit(8);

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
      const s = await fetchTorneoStats(match);
      setStats(s);
    } catch (e) {
      console.error('[PerfilPublico] stats', e);
      setStats({ torneosJugados: 0, torneosGanados: 0 });
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
  const categoriaColor = CATEGORIA_COLOR[perfil?.nivel] || '#999';
  const nombreCompleto = nombreCompletoJugadorPerfil(perfil) || String(perfil?.nombre || '').trim();
  const aliasGrande = String(perfil?.alias || '').trim();
  const igHandle = instagramHandleFromStored(perfil?.instagram_url);
  const igHref = igHandle ? `https://www.instagram.com/${encodeURIComponent(igHandle)}/` : '';

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
            }}
          >
            <img
              src={perfil.foto_url || '/default-avatar.svg'}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
                display: 'block',
              }}
            />
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
            <p style={{ margin: '0 0 4px', fontSize: '16px' }}>
              {paisFlag}{' '}
              <span style={{ color: '#555', fontSize: '14px' }}>{paisNombre}</span>
            </p>
          ) : null}
          {perfil.ciudad ? (
            <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '14px' }}>Club habitual: {perfil.ciudad}</p>
          ) : null}

          <div style={{ margin: '0 0 10px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {companeroDisplay?.kind === 'habitual'
                ? 'Compañero habitual'
                : companeroDisplay?.kind === 'ultimo'
                  ? 'Último compañero'
                  : 'Sin compañero habitual'}
            </p>
            <div
              style={{
                minHeight: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                fontSize: '14px',
              }}
            >
              {companeroDisplay?.row ? (
                <>
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
                    <span style={{ fontWeight: 600, color: '#475569' }}>
                      {nombreCompletoJugadorPerfil(companeroDisplay.row) || companeroDisplay.row.nombre || '—'}
                    </span>
                  )}
                </>
              ) : companeroDisplay?.kind ? (
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>—</span>
              ) : (
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                  — ¡sumate a jugar con él!
                </span>
              )}
            </div>
          </div>

          {igHref ? (
            <p style={{ margin: '8px 0 0' }}>
              <a
                href={igHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#c026d3', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}
              >
                @{igHandle}
              </a>
            </p>
          ) : null}

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {perfil.nivel ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: categoriaColor,
                }}
              >
                {perfil.nivel}
              </span>
            ) : null}
            {perfil.lateralidad ? <Badge text={perfil.lateralidad} color="#555" /> : null}
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
                {stats.torneosGanados != null ? stats.torneosGanados : '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>Torneos ganados</div>
            </div>
          </div>
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
