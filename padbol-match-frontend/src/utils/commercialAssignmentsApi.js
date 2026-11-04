import { getApiBaseUrl } from './apiPublicBaseUrl';
import {assertCrmSessionFresh,recordCrmSessionRejection,clearCrmSessionRejection} from './crmSessionFreshness';

// The backend verifies the session, role, case scope and assignment version.
export function createCommercialAssignmentsApi(token) {
  async function request(path, method = 'GET', body, revalidate=false) {
    if(!revalidate)assertCrmSessionFresh(token);
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(body ? {'Content-Type':'application/json'} : {}) },
      ...(body ? {body:JSON.stringify(body)} : {}),
    });
    if (!response.ok) {
      const failure=typeof response.json==='function'?await response.json().catch(()=>({})):{};
      const code=failure.code||failure.error;
      recordCrmSessionRejection(token,response.status,code);
      const messages={ADVISOR_REQUEST_DETAILS_CONFLICT:'Ya hay un alta pendiente para este correo. Revisá sus datos y condiciones en la lista antes de habilitarla.',CLOSURE_OUTCOME_REQUIRED:'Selecciona si la venta se concretó o no avanzó.',INVALID_CLOSURE_OUTCOME:'Elige un resultado comercial válido: Venta concretada o No avanzó.',FOLLOWUP_NOT_READY:'El seguimiento todavía no está habilitado. Revisa las plantillas aprobadas y la disponibilidad de envío.'};
      throw Object.assign(new Error('COMMERCIAL_ACTION_UNAVAILABLE'), {status:response.status,code,userMessage:messages[code]});
    }
    return response.json();
  }
  const cases = '/api/admin/crm/commercial-cases';
  const manualLeads = '/api/admin/crm/manual-leads';
  const prospect = '/api/admin/crm/prospect';
  const advisors = '/api/admin/crm/commercial-advisors';
  return {
    // Explicit user recovery probes authentication only; never replay a mutation.
    revalidateSession: async()=>{
      const result=await request('/api/admin/crm/commercial-role','GET',undefined,true);
      if(!['manager','advisor'].includes(result?.role))throw Object.assign(new Error('COMMERCIAL_ACTION_UNAVAILABLE'),{status:403,code:'FORBIDDEN'});
      clearCrmSessionRejection(token);return result;
    },
    resolveConversation: id => request(`/api/admin/crm/commercial-case-by-conversation/${encodeURIComponent(id)}`),
    prospectStatus: () => request(`${prospect}/status`),
    listProspects: (query={}) => { const params=new URLSearchParams(Object.entries(query).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>[k,String(v)])); return request(`${prospect}/prospects${params.toString()?`?${params}`:''}`); },
    searchProspects: payload => request(`${prospect}/prospects/search`, 'POST', payload),
    readProspect: id => request(`${prospect}/prospects/${encodeURIComponent(id)}`),
    updateProspect: (id,payload) => request(`${prospect}/prospects/${encodeURIComponent(id)}`, 'PATCH', payload),
    prospectDashboard: () => request(`${prospect}/dashboard`),
    listProspectCampaigns: () => request(`${prospect}/campaigns`),
    createProspectCampaign: payload => request(`${prospect}/campaigns`, 'POST', payload),
    campaignMessages: id => request(`${prospect}/campaigns/${encodeURIComponent(id)}/messages`),
    listProspectTerritories: () => request(`${prospect}/territories`),
    saveProspectTerritory: payload => request(`${prospect}/territories`, 'POST', payload),
    runProspectDue: () => request(`${prospect}/run-due`, 'POST', {}),
    updateProspectCampaign: (id,payload) => request(`${prospect}/campaigns/${encodeURIComponent(id)}`, 'PATCH', payload),
    simulateProspectCampaign: id => request(`${prospect}/campaigns/${encodeURIComponent(id)}/simulate`, 'POST', {}),
    simulateProspectFollowup: (id,day=14) => request(`${prospect}/campaigns/${encodeURIComponent(id)}/simulate-followup`, 'POST', {day}),
    listProspectSuppressions: () => request(`${prospect}/suppressions`),
    addProspectSuppression: payload => request(`${prospect}/suppressions`, 'POST', payload),
    prospectResponse: (id,text) => request(`${prospect}/prospects/${encodeURIComponent(id)}/response`, 'POST', {text}),
    searchManual: q => request(`${manualLeads}/search?q=${encodeURIComponent(q)}`),
    createManual: payload => request(manualLeads, 'POST', payload),
    readManual: id => request(`${manualLeads}/${encodeURIComponent(id)}`),
    updateManual: (id, payload) => request(`${manualLeads}/${encodeURIComponent(id)}`, 'PATCH', payload),
    linkManual: (id, conversationId) => request(`${manualLeads}/${encodeURIComponent(id)}/link`, 'POST', {conversationId}),
    getRole: () => request('/api/admin/crm/commercial-role'),
    listCases: () => request(cases),
    progress: (id, channel, expectedVersion, state, nextStep, nextContactAt, reminderHours, closureOutcome) => request(`${cases}/${encodeURIComponent(id)}/progress`, 'PUT', {channel,expectedVersion,state,nextStep,...(closureOutcome ? {closureOutcome} : {}),...(nextContactAt !== undefined ? {nextContactAt,reminderHours:reminderHours || [24,8]} : {})}),
    media: async (id, eventId) => {
      assertCrmSessionFresh(token);
      const response = await fetch(`${getApiBaseUrl()}${cases}/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}/media`, {headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      if (!response.ok) {
        const failure=typeof response.json==='function'?await response.json().catch(()=>({})):{};
        recordCrmSessionRejection(token,response.status,failure.code||failure.error);
        throw Object.assign(new Error('MEDIA_UNAVAILABLE'),{status:response.status,code:failure.code||failure.error});
      }
      return response.blob();
    },
    emailHistory: (id, channel) => request(`${cases}/${encodeURIComponent(id)}/email-history?channel=${encodeURIComponent(channel)}`),
    readCase: (id, channel) => request(`${cases}/${encodeURIComponent(id)}?channel=${encodeURIComponent(channel)}`),
    reply: (id, channel, body, requestId) => request(`${cases}/${encodeURIComponent(id)}/reply`, 'POST', {channel,body,requestId}),
    translateMessage: payload => request('/api/admin/crm/translate', 'POST', payload),
    listActivities: (id, channel) => request(`${cases}/${encodeURIComponent(id)}/activities?channel=${encodeURIComponent(channel)}`),
    addActivity: (id, channel, body) => request(`${cases}/${encodeURIComponent(id)}/activities`, 'POST', {channel,body}),
    listAdvisors: () => request(advisors),
    listCalls: (id, channel) => request(`${cases}/${encodeURIComponent(id)}/calls?channel=${encodeURIComponent(channel)}`),
    startCall: (id, channel) => request(`${cases}/${encodeURIComponent(id)}/calls`, 'POST', {channel}),
    completeCall: (id, callId, summary) => request(`${cases}/${encodeURIComponent(id)}/calls/${encodeURIComponent(callId)}/complete`, 'POST', summary),
    assign: (channel, id, advisorId, expectedVersion) => {
      if (!['form', 'whatsapp'].includes(channel) || !Number.isSafeInteger(expectedVersion)) return Promise.reject(new Error('ASSIGNMENT_VERSION_REQUIRED'));
      return request(`${cases}/${encodeURIComponent(id)}/assignment`, 'PUT', {channel,advisorId,expectedVersion});
    },
    addAdvisor: (email, details = {}) => request(advisors, 'POST', {email, ...details}),
    listAdvisorRequests: () => request('/api/admin/crm/commercial-advisor-requests'),
    decideAdvisorRequest: (id, decision) => request(`/api/admin/crm/commercial-advisor-requests/${encodeURIComponent(id)}/decision`, 'POST', {decision}),
    deactivateAdvisor: id => request(`${advisors}/${encodeURIComponent(id)}`, 'PATCH', {active:false}),
    getFollowupReadiness: (id, channel, language) => request(`${cases}/${encodeURIComponent(id)}/followup/readiness?channel=${encodeURIComponent(channel)}&language=${encodeURIComponent(language)}`),
    startFollowup: (id, channel, {consent, evidence, language}) => request(`${cases}/${encodeURIComponent(id)}/followup/start`, 'POST', {channel, consent, evidence, language}),
    cancelFollowup: (id, channel) => request(`${cases}/${encodeURIComponent(id)}/followup/cancel`, 'POST', {channel}),
  };
}
