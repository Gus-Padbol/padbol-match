import React, {useRef, useState} from 'react';
import {openConfirmedTournamentRegistration} from '../../utils/adminTournamentRegistration';

export default function OpenTournamentRegistration({available, apiBaseUrl, torneoId, t, onSaved}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const save = async () => {
    if (!available || pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    try {
      const row = await openConfirmedTournamentRegistration({apiBaseUrl, torneoId});
      onSaved(row);
      setSaved(true);
      setConfirming(false);
    } catch (e) {
      setError(e?.message || t('torneos.vista.networkError'));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };
  return <div style={{flexBasis: '100%'}}>
    {available && !confirming && <button type="button" className="btn-agregar-jugadores" onClick={() => {setConfirming(true); setError(''); setSaved(false);}}>{t('torneos.vista.openRegistration')}</button>}
    {available && confirming && <div role="group" aria-label={t('torneos.vista.confirmOpenRegistration')}>
      <p>{t('torneos.vista.confirmOpenRegistration')}</p>
      <div style={{display:'flex', flexWrap:'wrap', gap:'10px', justifyContent:'center'}}>
        <button type="button" className="btn-agregar-jugadores" disabled={loading} onClick={() => void save()}>{loading ? t('torneos.vista.openingRegistration') : t('torneos.vista.openRegistration')}</button>
        <button type="button" className="btn-agregar-jugadores" disabled={loading} onClick={() => {setConfirming(false); setError('');}}>{t('common.cancel', {defaultValue:'Cancelar'})}</button>
      </div>
    </div>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">{t('torneos.vista.registrationOpened', {defaultValue:'Inscripción abierta y guardado confirmado.'})}</p>}
  </div>;
}
