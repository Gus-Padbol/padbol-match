import React from 'react';
import {useSafeTranslation} from '../../i18n/tSafe';

/** Renders only server-confirmed tables: never applies legacy tournament tie rules. */
export default function NationsStandings({data, equipos = []}) {
  const {i18n} = useSafeTranslation();
  const text = (es,en) => String(i18n.language).startsWith('en') ? en : es;
  if (!data) return <p role="status">{text('Consultando posiciones confirmadas…','Loading confirmed standings…')}</p>;
  const names = new Map([...equipos, ...(data.teams || [])].map(team => [String(team.id),team.nombre]));
  const table = (rows, seeded = false) => <div className="nations-cup__table" tabIndex={0} role="region" aria-label={text('Tabla desplazable de Nations Cup','Scrollable Nations Cup table')}>
    <p className="nations-cup__scroll-hint">{text('Desliza para ver todas las columnas.','Scroll to view all columns.')}</p>
    <table><thead><tr>{[seeded ? text('Siembra','Seed') : text('Posición','Place'),text('Equipo','Team'),text('Grupo','Group'),'PJ','PTS','DS','SG','DG','GG'].map(label => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={`${row.group}-${row.equipo_id}`}><td>{(seeded ? row.seed : row.position) ?? '—'}</td><td>{names.get(String(row.equipo_id)) || text('Equipo no identificado','Unidentified team')}</td><td>{row.group || '—'}</td>{['jugados','puntos','diferencia_sets','sets_favor','diferencia_games','games_favor'].map(key => <td key={key}>{row[key] ?? '—'}</td>)}</tr>)}</tbody></table>
  </div>;
  return <section className="nations-cup nations-standings" aria-label={text('Posiciones confirmadas','Confirmed standings')}>
    {(data.standings || []).map(group => <div key={group.group}><h3>{text('Posiciones del grupo','Group standings')} {group.group}</h3>{table(group.rows)}</div>)}
    {!data.standings?.length ? <p>{text('Las posiciones aún no están disponibles.','Standings are not available yet.')}</p> : null}
    {data.thirds?.length ? <><h3>{text('Comparación de terceros','Third-place comparison')}</h3>{table(data.thirds)}</> : null}
    <h3>{text('Ocho clasificados y siembra','Eight qualifiers and seeding')}</h3>
    {data.qualified?.length ? table(data.qualified,true) : <p>{text('La clasificación aún no está confirmada.','Qualification has not been confirmed yet.')}</p>}
  </section>;
}
