import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { supabase } from '../supabaseClient';
import { formatNivelTorneo } from '../utils/torneoFormatters';
import { formatAliasConArroba, nombreCompletoJugadorPerfil } from '../utils/jugadorPerfil';

function safeJugadores(eq) {
  let j = eq?.jugadores;
  if (typeof j === 'string') {
    try {
      j = JSON.parse(j);
    } catch {
      j = [];
    }
  }
  return Array.isArray(j) ? j : [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function userIdsDesdeJugadoresEquipo(raw) {
  const ids = new Set();
  for (const p of raw) {
    const uid = String(p?.user_id || p?.id || '').trim();
    if (uid && UUID_RE.test(uid)) ids.add(uid);
  }
  return [...ids];
}

function mergeJugadorConPerfil(p, perfilPorUserId) {
  const uid = String(p?.user_id || p?.id || '').trim();
  const perfil = uid && perfilPorUserId && perfilPorUserId[uid];
  if (!perfil) return p;
  const str = (v) => String(v ?? '').trim();
  return {
    ...p,
    pais: str(perfil.pais) ? perfil.pais : p.pais,
    foto_url: str(perfil.foto_url) ? perfil.foto_url : p.foto_url,
    alias: str(perfil.alias) ? perfil.alias : p.alias,
    nombre: str(perfil.nombre) ? perfil.nombre : p.nombre,
    apellido: str(perfil.apellido) ? perfil.apellido : p.apellido,
  };
}

function slugJugador(p) {
  const alias = String(p?.alias || '').trim();
  if (alias) return alias;
  const nombre = String(nombreCompletoJugadorPerfil(p) || p?.nombre || 'jugador').trim();
  return nombre || 'jugador';
}

function jugadorAliasLabel(p) {
  const alias = String(p?.alias || '').trim();
  if (alias) return formatAliasConArroba(alias);
  const full = nombreCompletoJugadorPerfil(p);
  if (full) return full;
  return String(p?.nombre || 'Jugador').trim() || 'Jugador';
}

function jugadorNombreCompleto(p) {
  const full = nombreCompletoJugadorPerfil(p);
  if (full) return full;
  return String(p?.nombre || '').trim();
}

function parsePaisDisplay(p) {
  const raw = String(p?.pais || '').trim();
  if (!raw) return { flag: '🏳️', name: 'Sin país' };
  const parts = raw.split(' ').filter(Boolean);
  const maybeFlag = parts[0] || '';
  if (/^\p{Extended_Pictographic}+$/u.test(maybeFlag)) {
    return { flag: maybeFlag, name: parts.slice(1).join(' ') || 'Sin país' };
  }
  return { flag: '🏳️', name: raw };
}

function emojiMedalla(pos) {
  if (Number(pos) === 1) return '🥇';
  if (Number(pos) === 2) return '🥈';
  if (Number(pos) === 3) return '🥉';
  return '🏅';
}

function fechaCorta(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initialFromLabel(label) {
  const s = String(label || '').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (/[A-Za-zÀ-ÿ0-9]/.test(ch)) return ch.toUpperCase();
  }
  return '?';
}

function Avatar({ src, label, size }) {
  const initial = initialFromLabel(label);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        background: src ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #e2e8f0',
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span style={{ color: '#fff', fontWeight: 800, fontSize: `${Math.max(12, Math.round(size * 0.36))}px` }}>{initial}</span>
      )}
    </div>
  );
}

export default function EquipoPerfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [equipo, setEquipo] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [perfilPorUserId, setPerfilPorUserId] = useState({});

  const shellStyle = useMemo(
    () => ({
      minHeight: '100vh',
      paddingTop: hubContentPaddingTopCss(location.pathname),
      paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
      paddingLeft: 12,
      paddingRight: 12,
      boxSizing: 'border-box',
      background: 'linear-gradient(135deg,#667eea,#764ba2)',
    }),
    [location.pathname]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const eid = Number(id);
      if (!Number.isFinite(eid)) {
        if (!cancelled) {
          setEquipo(null);
          setHistorial([]);
          setPerfilPorUserId({});
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setPerfilPorUserId({});
      const { data: eq, error: eqErr } = await supabase
        .from('equipos')
        .select('id, nombre, foto_url, jugadores, torneo_id')
        .eq('id', eid)
        .maybeSingle();

      if (cancelled) return;
      if (eqErr || !eq) {
        setEquipo(null);
        setHistorial([]);
        setPerfilPorUserId({});
        setLoading(false);
        return;
      }

      setEquipo(eq);

      const rawJugadores = safeJugadores(eq);
      console.log('[EquipoPerfil] jugadores raw (desde equipo.jugadores)', rawJugadores);
      const uids = userIdsDesdeJugadoresEquipo(rawJugadores);
      console.log('[EquipoPerfil] userIds extraídos para join jugadores_perfil', uids);
      if (uids.length > 0) {
        const { data: perfiles, error: perfilErr } = await supabase
          .from('jugadores_perfil')
          .select('user_id, pais, foto_url, alias, nombre, apellido')
          .in('user_id', uids);
        if (cancelled) return;
        console.log('[EquipoPerfil] jugadores_perfil join resultado', {
          error: perfilErr,
          rows: perfiles,
          rowCount: Array.isArray(perfiles) ? perfiles.length : 0,
        });
        if (perfilErr) {
          console.error('[EquipoPerfil] jugadores_perfil', perfilErr);
          setPerfilPorUserId({});
        } else {
          const map = Object.fromEntries(
            (perfiles || []).map((row) => [String(row.user_id), row])
          );
          const mergedPreview = rawJugadores.map((p) => mergeJugadorConPerfil(p, map));
          console.log('[EquipoPerfil] mapa user_id → perfil', map);
          console.log('[EquipoPerfil] jugadores tras merge (preview)', mergedPreview);
          setPerfilPorUserId(map);
        }
      } else if (!cancelled) {
        console.log('[EquipoPerfil] sin userIds UUID; no se consulta jugadores_perfil');
        setPerfilPorUserId({});
      }

      const { data: rows, error: rowErr } = await supabase
        .from('tabla_puntos')
        .select('torneo_id, posicion, puntos')
        .eq('equipo_id', eid)
        .order('torneo_id', { ascending: false });
      if (cancelled) return;
      if (rowErr || !Array.isArray(rows) || rows.length === 0) {
        setHistorial([]);
        setLoading(false);
        return;
      }

      const torneoIds = [...new Set(rows.map((r) => r.torneo_id).filter((x) => x != null))];
      const { data: torneos } = await supabase
        .from('torneos')
        .select('id, nombre, nivel_torneo, fecha_inicio, fecha_fin, created_at, updated_at')
        .in('id', torneoIds);
      if (cancelled) return;

      const byId = new Map((torneos || []).map((t) => [t.id, t]));
      const merged = rows
        .map((r) => {
          const t = byId.get(r.torneo_id);
          const fecha = t?.fecha_fin || t?.fecha_inicio || t?.updated_at || t?.created_at || '';
          return {
            torneoId: r.torneo_id,
            nombre: String(t?.nombre || `Torneo #${r.torneo_id}`),
            nivel: formatNivelTorneo(t?.nivel_torneo),
            posicion: Number(r?.posicion) || 0,
            puntos: Number(r?.puntos) || 0,
            fecha,
          };
        })
        .sort((a, b) => {
          const da = Date.parse(a.fecha) || 0;
          const db = Date.parse(b.fecha) || 0;
          if (db !== da) return db - da;
          return (Number(b.torneoId) || 0) - (Number(a.torneoId) || 0);
        });
      setHistorial(merged);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const jugadores = useMemo(() => {
    const raw = safeJugadores(equipo);
    return raw.map((p) => mergeJugadorConPerfil(p, perfilPorUserId));
  }, [equipo, perfilPorUserId]);

  const cardWhite = {
    background: '#fff',
    borderRadius: 16,
    padding: 18,
    border: '1px solid rgba(255,255,255,0.35)',
    boxShadow: '0 8px 28px rgba(15,23,42,0.12)',
  };

  return (
    <div style={shellStyle}>
      <AppHeader title="Equipo" />
      <img
        src="/logo-padbol-match.png"
        alt="Padbol Match"
        style={{
          ...padbolLogoImgStyle,
          width: 64,
          maxWidth: 64,
          margin: '6px auto 14px',
        }}
      />
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={cardWhite}>
            <p style={{ margin: 0, color: '#64748b' }}>Cargando equipo...</p>
          </div>
        ) : !equipo ? (
          <div style={cardWhite}>
            <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>No se encontró el equipo.</p>
          </div>
        ) : (
          <>
              <div
                style={{
                  ...cardWhite,
                  marginBottom: 0,
                  padding: '16px 14px',
                  background: '#fff',
                }}
              >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                {String(equipo?.foto_url || '').trim() ? (
                  <Avatar src={String(equipo.foto_url).trim()} label={equipo.nombre} size={112} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {jugadores.slice(0, 4).map((p, idx) => {
                      const label = jugadorAliasLabel(p);
                      const foto = String(p?.foto_url || '').trim();
                      return (
                        <div key={`${label}-${idx}`} style={{ marginLeft: idx === 0 ? 0 : -12, zIndex: 20 - idx }}>
                          <div style={{ border: '2px solid #fff', borderRadius: '50%' }}>
                            <Avatar src={foto} label={label} size={72} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <h1 style={{ margin: '0 0 4px', textAlign: 'center', fontSize: '32px', fontWeight: 900, lineHeight: 1.2, color: '#0f172a' }}>
                {String(equipo.nombre || '').trim() || `Equipo #${equipo.id}`}
              </h1>
              </div>

              <div style={{ ...cardWhite, padding: 14, display: 'grid', gap: 10 }}>
                {jugadores.map((p, idx) => {
                  const aliasLabel = jugadorAliasLabel(p);
                  const fullName = jugadorNombreCompleto(p);
                  const pais = parsePaisDisplay(p);
                  const foto = String(p?.foto_url || '').trim();
                  const slug = encodeURIComponent(slugJugador(p));
                  return (
                    <button
                      key={`${aliasLabel}-${idx}`}
                      type="button"
                      onClick={() => navigate(`/jugador/${slug}`)}
                      style={{
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        borderRadius: 12,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <Avatar src={foto} label={aliasLabel} size={48} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: '#2563eb',
                              textDecoration: 'underline',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {aliasLabel}
                          </div>
                          {fullName && fullName !== aliasLabel ? (
                            <div
                              style={{
                                marginTop: 2,
                                color: '#64748b',
                                fontSize: 12,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fullName}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, color: '#475569', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {`${pais.flag} ${pais.name}`}
                      </div>
                    </button>
                  );
                })}
              </div>

              {historial.length > 0 ? (
                <div style={{ ...cardWhite, marginTop: 0 }}>
                  <h3 style={{ margin: '0 0 10px', color: '#334155', fontSize: 16 }}>{`🏆 Historial del equipo (${historial.length} torneos)`}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historial.map((h) => (
                      <button
                        key={`${h.torneoId}-${h.posicion}-${h.puntos}`}
                        type="button"
                        onClick={() => navigate(`/torneo/${h.torneoId}`)}
                        style={{
                          width: '100%',
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          borderRadius: 10,
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          textAlign: 'left',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                      >
                        <span style={{ flexShrink: 0, lineHeight: 1.2 }}>{emojiMedalla(h.posicion)}</span>
                        <span
                          style={{
                            minWidth: 0,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            color: '#0f172a',
                          }}
                        >
                          {`${h.nombre} · ${h.nivel} · ${h.puntos} pts · ${fechaCorta(h.fecha)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
      </div>
      <BottomNav />
    </div>
  );
}
