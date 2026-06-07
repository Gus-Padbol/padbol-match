import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSafeTranslation } from '../i18n/tSafe';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { fetchCanchaActiva, postJugadorTemp } from '../utils/scoreboardApi';
import '../styles/ScoreboardJoin.css';

const FOTO_BUCKET = 'scoreboard-fotos';

function normalizeEquipo(raw) {
  const eq = String(raw || '').trim().toLowerCase();
  return eq === 'b' ? 'b' : eq === 'a' ? 'a' : null;
}

function ladoLabel(equipo, t) {
  if (equipo === 'b') {
    return t('scoreboard.join.sideRed', '🔴 Lado Rojo');
  }
  return t('scoreboard.join.sideBlue', '🔵 Lado Azul');
}

function playerInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export default function ScoreboardJoin() {
  const { t } = useSafeTranslation();
  const { sedeId, cancha: canchaParam, equipo: equipoParam } = useParams();
  const { session, userProfile } = useAuth();
  const equipoFromUrl = normalizeEquipo(equipoParam);
  const cancha = decodeURIComponent(String(canchaParam || '').trim());

  const [selectedEquipo, setSelectedEquipo] = useState(equipoFromUrl);
  const equipo = equipoFromUrl || selectedEquipo;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activo, setActivo] = useState(null);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [slot, setSlot] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const loadCancha = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCanchaActiva(sedeId, cancha);
      if (!data?.partido_id) {
        setActivo(null);
      } else {
        setActivo(data);
      }
    } catch (err) {
      setActivo(null);
      setError(err?.message || t('scoreboard.join.loadError', 'No se pudo cargar la cancha'));
    } finally {
      setLoading(false);
    }
  }, [sedeId, cancha, t]);

  useEffect(() => {
    void loadCancha();
  }, [loadCancha]);

  useEffect(() => {
    if (equipoFromUrl) {
      setSelectedEquipo(equipoFromUrl);
    }
  }, [equipoFromUrl]);

  useEffect(() => {
    if (!session?.user) return;
    const profileNombre = String(
      userProfile?.nombre || userProfile?.alias || '',
    ).trim();
    const profileFoto = String(userProfile?.foto_url || userProfile?.foto || '').trim();
    if (profileNombre && !nombre) setNombre(profileNombre);
    if (profileFoto && !fotoUrl && !fotoPreview) {
      setFotoUrl(profileFoto);
      setFotoPreview(profileFoto);
    }
  }, [session?.user, userProfile, nombre, fotoUrl, fotoPreview]);

  const ocupadosEquipo = useMemo(() => {
    if (!equipo) return [];
    const list = Array.isArray(activo?.jugadores) ? activo.jugadores : [];
    return list
      .filter((j) => String(j.equipo || '').toLowerCase() === equipo)
      .map((j) => Number(j.slot))
      .filter((n) => Number.isFinite(n));
  }, [activo, equipo]);

  const slotsLibres = useMemo(
    () => [1, 2, 3, 4].filter((s) => !ocupadosEquipo.includes(s)),
    [ocupadosEquipo],
  );

  useEffect(() => {
    if (!equipo) return;
    if (!slot && slotsLibres.length > 0) {
      setSlot(String(slotsLibres[0]));
    }
    if (slot && !slotsLibres.includes(Number(slot))) {
      setSlot(slotsLibres[0] ? String(slotsLibres[0]) : '');
    }
  }, [equipo, slot, slotsLibres]);

  const equipoNombre = equipo === 'b' ? activo?.nombre_b : activo?.nombre_a;

  const onFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoUrl('');
    setFotoPreview(URL.createObjectURL(file));
  };

  const uploadFoto = async () => {
    if (!fotoFile || !activo?.partido_id || !equipo) return fotoUrl || null;
    const ext = (fotoFile.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${activo.partido_id}/${equipo}/${slot || '0'}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(FOTO_BUCKET).upload(path, fotoFile, {
      upsert: true,
      contentType: fotoFile.type || 'image/jpeg',
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(FOTO_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activo?.partido_id || !slot || !equipo) return;
    setSaving(true);
    setError('');
    try {
      let finalFoto = fotoUrl || null;
      if (fotoFile) {
        finalFoto = await uploadFoto();
      }
      await postJugadorTemp({
        partido_id: activo.partido_id,
        equipo,
        slot: Number(slot),
        nombre: nombre.trim(),
        numero: numero.trim() ? Number(numero) : Number(slot),
        foto_url: finalFoto,
        user_id: session?.user?.id || null,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || t('scoreboard.join.saveError', 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const onPickSide = (side) => {
    setError('');
    setSelectedEquipo(side);
  };

  const onChangeSide = () => {
    if (equipoFromUrl) return;
    setError('');
    setSelectedEquipo(null);
    setSlot('');
  };

  return (
    <div className="sb-join">
      <div className="sb-join__card">
        <p className="sb-join__brand">Padbol Match</p>
        <h1 className="sb-join__title">
          {t('scoreboard.join.title', 'Sumate al marcador')}
        </h1>
        <p className="sb-join__meta">
          {cancha}
          {equipo ? (
            <>
              {' · '}
              {ladoLabel(equipo, t)}
            </>
          ) : null}
        </p>

        {loading ? (
          <p className="sb-join__status">{t('scoreboard.join.loading', 'Cargando...')}</p>
        ) : null}

        {!loading && !activo?.partido_id ? (
          <p className="sb-join__empty">
            {t(
              'scoreboard.join.noMatch',
              'No hay partido activo ahora. Volvé cuando sea tu turno.',
            )}
          </p>
        ) : null}

        {!loading && activo?.partido_id && done ? (
          <div className="sb-join__success">
            <p className="sb-join__success-msg">
              {t('scoreboard.join.success', '¡Listo! Ya aparecés en el marcador 🎉')}
            </p>
            <a
              className="sb-join__cta"
              href="https://padbolmatch.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('scoreboard.join.downloadCta', 'Descargá Padbol Match')}
            </a>
          </div>
        ) : null}

        {!loading && activo?.partido_id && !done && !equipo ? (
          <>
            <p className="sb-join__match">
              {activo.nombre_a}
              {' '}
              <span>vs</span>
              {' '}
              {activo.nombre_b}
            </p>
            <p className="sb-join__pick-label">
              {t('scoreboard.join.pickSide', '¿De qué lado jugás?')}
            </p>
            <div className="sb-join__side-pick">
              <button
                type="button"
                className="sb-join__side-btn sb-join__side-btn--blue"
                onClick={() => onPickSide('a')}
              >
                {t('scoreboard.join.sideBlueBtn', '🔵 Soy del lado azul')}
              </button>
              <button
                type="button"
                className="sb-join__side-btn sb-join__side-btn--red"
                onClick={() => onPickSide('b')}
              >
                {t('scoreboard.join.sideRedBtn', '🔴 Soy del lado rojo')}
              </button>
            </div>
          </>
        ) : null}

        {!loading && activo?.partido_id && !done && equipo ? (
          <>
            <p className="sb-join__match">
              {activo.nombre_a}
              {' '}
              <span>vs</span>
              {' '}
              {activo.nombre_b}
            </p>
            <p className="sb-join__team-label">
              {t('scoreboard.join.playingFor', 'Jugás en')}
              {' '}
              <strong>{equipoNombre}</strong>
            </p>

            {!equipoFromUrl ? (
              <button type="button" className="sb-join__change-side" onClick={onChangeSide}>
                {t('scoreboard.join.changeSide', 'Cambiar lado')}
              </button>
            ) : null}

            {slotsLibres.length === 0 ? (
              <p className="sb-join__empty">
                {t('scoreboard.join.noSlots', 'Este equipo ya tiene los 4 jugadores cargados')}
              </p>
            ) : (
              <form className="sb-join__form" onSubmit={onSubmit}>
                <label className="sb-join__field">
                  <span>{t('scoreboard.join.slot', 'Posición')}</span>
                  <select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    required
                  >
                    {slotsLibres.map((s) => (
                      <option key={s} value={String(s)}>
                        {t('scoreboard.join.slotN', 'Jugador {{n}}', { n: s })}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sb-join__field">
                  <span>{t('scoreboard.join.name', 'Nombre')}</span>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>

                <label className="sb-join__field">
                  <span>{t('scoreboard.join.jersey', 'Número de camiseta')}</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder={slot || '1'}
                  />
                </label>

                <label className="sb-join__field sb-join__field--photo">
                  <span>{t('scoreboard.join.photo', 'Foto (opcional)')}</span>
                  <div className="sb-join__photo-row">
                    {fotoPreview ? (
                      <img src={fotoPreview} alt="" className="sb-join__photo-preview" />
                    ) : (
                      <span className="sb-join__photo-placeholder" aria-hidden="true">
                        {playerInitials(nombre)}
                      </span>
                    )}
                    <input type="file" accept="image/*" onChange={onFotoChange} />
                  </div>
                </label>

                {error ? <p className="sb-join__error">{error}</p> : null}

                <button type="submit" className="sb-join__submit" disabled={saving}>
                  {saving
                    ? t('scoreboard.join.saving', 'Guardando...')
                    : t('scoreboard.join.submit', 'Aparecer en el marcador')}
                </button>
              </form>
            )}
          </>
        ) : null}

        <p className="sb-join__footer">
          <Link to="/">{t('scoreboard.join.backHome', 'Volver al inicio')}</Link>
        </p>
      </div>
    </div>
  );
}
