// Transport circuit breaker, not authentication. The backend remains authoritative.
// In-memory only: never persisted, logged, or used to grant access.
const rejectedSessions=new Set();
export function clearCrmSessionRejection(token) { rejectedSessions.delete(token); }
export function assertCrmSessionFresh(token) {
  if(rejectedSessions.has(token))throw Object.assign(new Error('La sesión no es válida. Conserva el borrador e inicia sesión nuevamente.'),{status:401,code:'UNAUTHENTICATED'});
}
export function recordCrmSessionRejection(token,status,code) {
  if(status!==401||!['UNAUTHENTICATED','CRM_ADMIN_UNAUTHENTICATED'].includes(code))return;
  rejectedSessions.add(token);
  // Bound memory if multiple accounts/tabs renew sessions during a long visit.
  if(rejectedSessions.size>8)rejectedSessions.delete(rejectedSessions.values().next().value);
}
