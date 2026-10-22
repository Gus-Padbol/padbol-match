import React, {useEffect, useRef, useState} from 'react';
import {openConfirmedTournamentRegistration} from '../../utils/adminTournamentRegistration';

export default function OpenTournamentRegistration({available, apiBaseUrl, torneoId, t, onSaved}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const lifecycle = useRef(0);
  useEffect(() => {
    const generation = ++lifecycle.current;
    return () => {if (lifecycle.current === generation) lifecycle.current += 1;};
  }, [torneoId]);
  const buttonStyle = {minHeight:'44px', maxWidth:'100%', whiteSpace:'normal'};
  const save = async () => {
    if (!available || pending.current) return;
    const generation = lifecycle.current;
    const isCurrent = () => lifecycle.current === generation;
    pending.current = true;
    setLoading(true);
    setError('');
    try {
      const row = await openConfirmedTournamentRegistration({apiBaseUrl, torneoId});
      if (!isCurrent()) return;
      onSaved(row);
      setSaved(true);
      setConfirming(false);
    } catch (e) {
      if (!isCurrent()) return;
      setError(e?.message || t('torneos.vista.networkError'));
    } finally {
      pending.current = false;
      if (isCurrent()) setLoading(false);
    }
  };
  return <div style={{flexBasis:'100%', width:'100%', maxWidth:'100%', minWidth:0, overflowWrap:'anywhere'}}>
    {available && !confirming && <button type="button" className="btn-agregar-jugadores" style={buttonStyle} onClick={() => {setConfirming(true); setError(''); setSaved(false);}}>{t('torneos.vista.openRegistration')}</button>}
    {available && confirming && <div role="group" aria-label={t('torneos.vista.confirmOpenRegistration')}>
      <p>{t('torneos.vista.confirmOpenRegistration')}</p>
      <div style={{display:'flex', flexWrap:'wrap', gap:'10px', justifyContent:'center'}}>
        <button type="button" className="btn-agregar-jugadores" style={buttonStyle} disabled={loading} onClick={() => void save()}>{loading ? t('torneos.vista.openingRegistration') : t('torneos.vista.openRegistration')}</button>
        <button type="button" className="btn-agregar-jugadores" style={buttonStyle} disabled={loading} onClick={() => {setConfirming(false); setError('');}}>{t('common.cancel', {defaultValue:'Cancelar'})}</button>
      </div>
    </div>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">{t('torneos.vista.registrationOpened', {defaultValue:'Inscripción abierta y guardado confirmado.'})}</p>}
  </div>;
}
