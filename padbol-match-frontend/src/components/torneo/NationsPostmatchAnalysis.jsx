import React from 'react';
import {useSafeTranslation} from '../../i18n/tSafe';
import useNationsPostmatch from '../../hooks/useNationsPostmatch';
const {formatCourtTime} = require('../../utils/nationsPostmatchPure.cjs');

export default function NationsPostmatchAnalysis({partidoId, accessToken, apiBaseUrl}) {
  const {t} = useSafeTranslation();
  const result = useNationsPostmatch({id: partidoId, accessToken, baseUrl: apiBaseUrl});
  const pending = ['loading', 'queued', 'generating'].includes(result.state);
  const messageKey = result.state === 'unauthorized' ? 'signIn' : result.state === 'insufficient' ? 'insufficient' : result.state === 'uncertain' ? 'uncertain' : pending ? 'pending' : 'failed';
  return <section aria-label={t('nationsPostmatch.title')} className="pdm-analysis" style={{marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16}}>
    <h3 className="pdm-section-title">{t('nationsPostmatch.title')}</h3>
    {result.state === 'ready' ? <>
      <p style={{whiteSpace: 'pre-line', overflowWrap: 'anywhere'}}>{result.resumen.summary}</p>
      {result.resumen.highlights.length ? <ul>{result.resumen.highlights.map((text, index) => <li key={index}>{text}</li>)}</ul> : null}
      {result.resumen.observed.players.length ? <dl style={{margin: '12px 0'}}>{result.resumen.observed.players.map((player, index) => <div key={index} style={{padding: '8px 0', borderBottom: '1px solid var(--border)'}}>
        <dt style={{fontWeight: 700, overflowWrap: 'anywhere'}}>{player.name}</dt>
        <dd style={{margin: 0}}>{t('nationsPostmatch.time')}: {formatCourtTime(player.on_court_seconds)} · {t('nationsPostmatch.points')}: {player.points_observed}</dd>
      </div>)}</dl> : null}
      <p className="pdm-placeholder">{t('nationsPostmatch.basis')}</p>
      {result.refreshError ? <p role="alert">{t('nationsPostmatch.failed')}</p> : null}
    </> : <p role={pending ? 'status' : 'note'} aria-live="polite">{t(`nationsPostmatch.${messageKey}`)}</p>}
    {result.state !== 'unauthorized' && (!pending || result.pollingPaused) ? <button type="button" className="pdm-btn-cerrar" disabled={result.refreshing} onClick={result.refresh}>{t('general.retry')}</button> : null}
  </section>;
}
