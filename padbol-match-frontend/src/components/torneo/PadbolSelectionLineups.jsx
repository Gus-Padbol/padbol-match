import React, { useEffect, useRef, useState } from 'react';
import { useSafeTranslation } from '../../i18n/tSafe';
import { readSelectionLineup, saveSelectionLineup } from '../../utils/padbolSelectionApi';
import { selectionPlayerId, validateSelectionLineup } from '../../utils/padbolSelectionRoster';

const blank = () => ({ iniciales: ['', ''], suplentes: ['', ''] });
function TeamLineup({ apiBaseUrl, torneoId, partidoId, equipoId, nombre, onValid }) {
  const { i18n } = useSafeTranslation();
  const en = String(i18n?.language || '').startsWith('en');
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(true);
  const savingRef = useRef(false);
  const validRef = useRef(onValid);
  validRef.current = onValid;
  useEffect(() => {
    let cancelled = false;
    active.current = true;
    setLoading(true); validRef.current(false);
    readSelectionLineup({ apiBaseUrl, torneoId, partidoId, equipoId }).then(dto => {
      if (cancelled) return;
      if (!dto.required) throw new Error(en ? 'The server did not confirm the selection roster mode.' : 'El servidor no confirmó la modalidad de plantel de selección.');
      setData(dto); setDraft(dto.alineacion ? { iniciales: [...dto.alineacion.iniciales], suplentes: [...dto.alineacion.suplentes] } : blank());
      validRef.current(Boolean(dto.alineacion));
    }).catch(err => { if (!cancelled) setError(err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; active.current = false; };
  }, [apiBaseUrl, torneoId, partidoId, equipoId, en]);
  const change = (group, slot, value) => {
    setDraft(prev => ({ ...prev, [group]: prev[group].map((id, index) => index === slot ? value : id) }));
    validRef.current(false); setNotice(''); setError('');
  };
  const save = async event => {
    event.preventDefault();
    if (savingRef.current || !data?.can_edit) return;
    let alignment;
    try { alignment = validateSelectionLineup(draft, data.plantel); } catch (err) { setError(err.message); return; }
    savingRef.current = true; setSaving(true); setError(''); setNotice(''); validRef.current(false);
    try {
      const args = { apiBaseUrl, torneoId, partidoId, equipoId };
      const saved = await saveSelectionLineup({ ...args, alineacion: alignment, plantel: data.plantel, expected_revision: data.alineacion?.revision ?? 0 });
      const confirmed = await readSelectionLineup(args);
      if (!confirmed.alineacion || confirmed.alineacion.revision !== saved.alineacion.revision
        || ['iniciales', 'suplentes'].some(group => confirmed.alineacion[group].join() !== alignment[group].join())) throw new Error(en ? 'Reload the match: the saved lineup could not be confirmed.' : 'Recarga el partido: no se pudo confirmar la alineación guardada.');
      if (!active.current) return;
      setData(confirmed); setDraft(alignment); validRef.current(true);
      setNotice(en ? 'Lineup saved and verified.' : 'Alineación guardada y verificada.');
    } catch (err) { if (active.current) setError(err.message); }
    finally { savingRef.current = false; if (active.current) setSaving(false); }
  };
  const chosen = [...draft.iniciales, ...draft.suplentes];
  return <form className="padbol-selection-team" onSubmit={save} aria-label={`${en ? 'Lineup' : 'Alineación'} ${nombre}`}>
    <h4>{nombre}</h4>
    {loading ? <p role="status">{en ? 'Loading confirmed roster…' : 'Cargando plantel confirmado…'}</p> : data ? <>
      <fieldset disabled={!data.can_edit || saving}>
        {['iniciales', 'suplentes'].map(group => <div className="padbol-selection-slots" key={group}>
          <strong>{group === 'iniciales' ? (en ? 'Starting players' : 'Jugadores iniciales') : (en ? 'Substitutes' : 'Suplentes')}</strong>
          {[0, 1].map(slot => <label key={slot}>{group === 'iniciales' ? (en ? 'Starting player' : 'Inicial') : (en ? 'Substitute' : 'Suplente')} {slot + 1}
            <select value={draft[group][slot]} onChange={event => change(group, slot, event.target.value)} required>
              <option value="">{en ? 'Choose a roster player' : 'Seleccionar jugador del plantel'}</option>
              {data.plantel.map(player => { const id = selectionPlayerId(player); return id ? <option key={id} value={id} disabled={chosen.includes(id) && draft[group][slot] !== id}>{player.nombre || (en ? 'Registered player' : 'Jugador registrado')}</option> : null; })}
            </select>
          </label>)}
        </div>)}
      </fieldset>
      {data.can_edit ? <button type="submit" disabled={saving}>{saving ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save four-player lineup' : 'Guardar los cuatro presentados')}</button>
        : <p>{en ? 'Read only. The captain or authorized administrator can declare the lineup before the match starts.' : 'Solo lectura. El capitán o un administrador autorizado declara la alineación antes de iniciar el partido.'}</p>}
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </form>;
}
export default function PadbolSelectionLineups({ apiBaseUrl, torneoId, partido, equipos, onReadyChange }) {
  const { i18n } = useSafeTranslation();
  const en = String(i18n?.language || '').startsWith('en');
  const [valid, setValid] = useState({});
  const callback = useRef(onReadyChange); callback.current = onReadyChange;
  const ids = [partido.equipo_a_id, partido.equipo_b_id];
  const ready = ids.every(id => valid[String(id)] === true);
  useEffect(() => { callback.current?.(ready); }, [ready]);
  return <section className="padbol-selection" aria-label={en ? 'Four players per team' : 'Cuatro presentados por equipo'}>
    <h3>{en ? 'Match lineup' : 'Alineación del partido'}</h3>
    <p>{en ? 'Each team declares exactly four players: two starting players and two substitutes. Only two play on court at a time. Players may alternate in odd-numbered games.' : 'Cada equipo presenta exactamente cuatro jugadores: dos iniciales y dos suplentes. Siempre juegan dos en cancha. Los jugadores pueden alternar en los games impares.'}</p>
    <p>{en ? 'This declaration is saved separately from the roster. Manual set scores do not track substitutions game by game.' : 'Esta declaración se guarda por separado del plantel. La carga manual de sets no registra los cambios game por game.'}</p>
    <div className="padbol-selection-grid">{ids.map(id => <TeamLineup key={id} apiBaseUrl={apiBaseUrl} torneoId={torneoId} partidoId={partido.id} equipoId={id} nombre={equipos.find(team => String(team.id) === String(id))?.nombre || `${en ? 'Team' : 'Equipo'} ${id}`} onValid={value => setValid(prev => ({ ...prev, [String(id)]: value }))} />)}</div>
    {!ready ? <p role="status">{en ? 'Confirm the four players of both teams before saving a result.' : 'Confirma los cuatro presentados de ambos equipos antes de guardar un resultado.'}</p> : null}
  </section>;
}
