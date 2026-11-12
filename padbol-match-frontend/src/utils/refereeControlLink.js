import {getAuthHeaders} from './scoreboardApi';
import {getApiBaseUrl} from './apiPublicBaseUrl';

/** Issue only through the existing staff endpoint; capabilities cannot issue capabilities. */
export async function issueRefereeControlLink({scoreboardId,controlToken,fetchImpl=fetch,origin=window.location.origin}) {
 if(controlToken||!scoreboardId)throw Error('REFEREE_LINK_UNAVAILABLE');
 const headers=await getAuthHeaders();
 if(!headers.Authorization)throw Error('AUTH_REQUIRED');
 const base=getApiBaseUrl();
 const response=await fetchImpl(`${base}/api/scoreboard/partidos/${encodeURIComponent(scoreboardId)}/control-token`,{method:'POST',headers,body:'{}',cache:'no-store'});
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw Error('REFEREE_LINK_UNAVAILABLE');
 const token=result?.control_token;
 if(result?.ok!==true||String(result.scoreboard_id)!==String(scoreboardId)||typeof token!=='string'||!/^[A-Za-z0-9_-]{32,512}$/.test(token)||result.control_path!==`/scoreboard/control/${encodeURIComponent(token)}`)throw Error('REFEREE_LINK_SCOPE_INVALID');
 // Confirm the new capability against the authoritative board before exposing its link.
 const check=await fetchImpl(`${base}/api/scoreboard/control/${encodeURIComponent(token)}/nations/context`,{cache:'no-store'});
 const context=await check.json().catch(()=>null);
 if(!check.ok||String(context?.scoreboardId)!==String(scoreboardId))throw Error('REFEREE_LINK_SCOPE_INVALID');
 return new URL(result.control_path,origin).href;
}
