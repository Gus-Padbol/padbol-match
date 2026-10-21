export default function PendingValidationActions({ isSuperAdmin, saving, onApprove, onReject, onCategory, approveLabel, rejectLabel, categoryLabel }) {
  const style = color => ({ padding: '7px 14px', background: color, color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: saving ? 0.6 : 1 });
  return <>
    <button disabled={saving} onClick={onApprove} className="admin-validacion-action admin-validacion-action--approve" style={style('#43a047')}>{approveLabel}</button>
    {isSuperAdmin && <button disabled={saving} onClick={onReject} className="admin-validacion-action admin-validacion-action--reject" style={style('#b91c1c')}>{rejectLabel}</button>}
    <button disabled={saving} onClick={onCategory} className="admin-validacion-action admin-validacion-action--category" style={style('#1976d2')}>{categoryLabel}</button>
  </>;
}
