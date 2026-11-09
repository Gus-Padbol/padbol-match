export default function PendingValidationBulkActions({ bulk, visibleCount, isSuperAdmin, disabled, onRefresh, t }) {
  const buttonStyle = color => ({ minHeight: 44, padding: '9px 14px', border: 'none', borderRadius: 6, background: color, color: '#fff', fontWeight: 700, whiteSpace: 'normal', cursor: disabled || bulk.blocked ? 'default' : 'pointer', opacity: disabled || bulk.blocked || !bulk.selected.length ? 0.6 : 1 });
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
      <input type="checkbox" style={{ width: 22, height: 22 }} checked={visibleCount > 0 && bulk.selected.length === visibleCount} disabled={disabled || bulk.blocked || !visibleCount} onChange={bulk.toggleAll} />
      {t('admin.formularios.bulkValidationSelectVisible', { defaultValue: 'Select all visible' })}
    </label>
    <span>{t('admin.formularios.bulkValidationSelected', { defaultValue: '{{count}} selected', count: bulk.selected.length })}</span>
    <button type="button" style={buttonStyle('#2e7d32')} disabled={disabled || bulk.blocked || !bulk.selected.length} onClick={() => void bulk.run('aprobar')}>{t('admin.formularios.bulkValidationApprove', { defaultValue: 'Approve selected' })}</button>
    {isSuperAdmin && <button type="button" style={buttonStyle('#b91c1c')} disabled={disabled || bulk.blocked || !bulk.selected.length} onClick={() => void bulk.run('rechazar')}>{t('admin.formularios.bulkValidationReject', { defaultValue: 'Reject selected' })}</button>}
    {bulk.busy && <span role="status">{t('admin.metricas.savingDots')}</span>}
    {bulk.outcome && <div role={bulk.blocked ? 'alert' : 'status'} style={{ flexBasis: '100%' }}>
      {t('admin.formularios.bulkValidationProgress', { defaultValue: '{{completed}} of {{total}} confirmed.', completed: bulk.outcome.completed, total: bulk.outcome.total })}
      {bulk.blocked && <> {t('admin.formularios.bulkValidationStopped', { defaultValue: 'Processing stopped. Refresh the list to check the last result before trying again.' })} {bulk.outcome.error} <button type="button" style={{ minHeight: 44, padding: '9px 14px', marginTop: 8 }} onClick={onRefresh} disabled={disabled}>{t('admin.formularios.bulkValidationRefresh', { defaultValue: 'Refresh list' })}</button></>}
    </div>}
  </div>;
}
