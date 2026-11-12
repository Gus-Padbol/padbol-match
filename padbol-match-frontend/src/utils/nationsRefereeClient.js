/** Existing referee credentials only. Never log control URLs or retry with a new intent. */
export function createNationsRefereeClient({apiBase = '', scoreboardId, controlToken, accessToken, getAccessToken, fetchImpl = fetch}) {
  const tokenMode = Boolean(controlToken);
  const boardPath = tokenMode ? `/api/scoreboard/control/${encodeURIComponent(controlToken)}` : `/api/scoreboard/partidos/${encodeURIComponent(scoreboardId)}`;
  const durablePath = tokenMode ? `${boardPath}/nations` : `/api/nations/marker/${encodeURIComponent(scoreboardId)}`;
  async function request(path, body) {
    const bearer = getAccessToken ? getAccessToken() : accessToken;
    const headers = {'Content-Type':'application/json', ...(!tokenMode && bearer ? {Authorization:`Bearer ${bearer}`} : {})};
    const response = await fetchImpl(`${apiBase}${path}`, {headers, ...(body ? {method:'POST',body:JSON.stringify(body)} : {})});
    const data = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(data?.code || 'REFEREE_REQUEST_FAILED'), {code:data?.code || 'REFEREE_REQUEST_FAILED',status:response.status});
    return data;
  }
  return {
    async read() {
      const board = await request(boardPath);
      if (!board?.id) throw Error('REFEREE_CONTEXT_INVALID');
      let hiddenTournament = false;
      if (!tokenMode) {
        if (!board.torneo_id && !board.partido_torneo_id) return {mode:'legacy',board};
        if (board.torneo_id) {
        try {
          const tournament = await request(`/api/torneos/${encodeURIComponent(board.torneo_id)}`);
          if (tournament?.modalidad_plantel !== 'selecciones' && !tournament?.plan_nations) return {mode:'legacy',board};
        } catch (error) {
          if (error.status !== 404) throw error;
          // A hidden QA catalog entry cannot classify an authorized match as legacy.
          hiddenTournament = true;
        }
        }
      }
      let context;
      try { context = await request(`${durablePath}/context`); }
      catch (error) { if (!hiddenTournament && error.status === 403 && error.code === 'NOT_NATIONS_TOURNAMENT') return {mode:tokenMode?'legacy-token':'legacy',board}; throw error; }
      if (String(context?.scoreboardId) !== String(board.id) || !context?.membership?.A || !context?.membership?.B) throw Error('REFEREE_CONTEXT_INVALID');
      const teams = [String(context.membership.A), String(context.membership.B)];
      if (teams[0] === teams[1] || teams.some(id => !context.teams?.[id])) throw Error('REFEREE_CONTEXT_INVALID');
      const markers = context.hasBaseline ? await Promise.all(teams.map(id => request(`${durablePath}?teamId=${encodeURIComponent(id)}`))) : [];
      const epoch = markers[0]?.gamesEpoch ?? context.gamesEpoch ?? 0;
      const revision = markers[0]?.matchRevision ?? 0;
      const clockSynced = markers.every(m => m.code !== 'CLOCK_OUT_OF_SYNC');
      const coherent = (!context.hasBaseline || markers.length === 2) && markers.every((m, index) => String(m.teamId) === teams[index] && m.state?.active?.length === 2 && m.gamesEpoch === epoch && m.matchRevision === revision && m.trackingStatus !== 'reset_pending');
      return {mode:'nations',board,context,markers,epoch,revision,coherent,clockSynced,
        window:coherent && clockSynced && markers.length && markers.every(m => m.substitution_window?.allowed === true) ? markers[0].substitution_window : null};
    },
    attempt(kind, snapshot, payload = {}, makeId = () => crypto.randomUUID()) {
      if (snapshot.mode === 'legacy-token') {
        const suffix = kind === 'point' ? `/punto/${payload.side}` : kind === 'resume' || kind === 'start' ? '/cronometro/start' : kind === 'pause' ? '/cronometro/pause' : kind === 'undo' ? '/undo' : null;
        if (!suffix) throw Error('REFEREE_ACTION_UNAVAILABLE');
        return {path:`${boardPath}${suffix}`,body:{}};
      }
      const key = makeId();
      if (kind === 'point' || kind === 'undo') return {path:`${boardPath}${kind === 'point' ? `/punto/${payload.side}` : '/undo'}`,body:{requestId:key,epoch:snapshot.epoch}};
      if (kind === 'start') return {path:`${durablePath}/start`,body:{idempotencyKey:key,payload:{}}};
      if (kind === 'substitution') return {path:`${durablePath}/team/${encodeURIComponent(payload.teamId)}/commands`,body:{type:kind,eventId:makeId(),idempotencyKey:key,expectedRevision:snapshot.revision,epoch:snapshot.epoch,swaps:payload.swaps.map(s => ({outId:s.outId,inId:s.inId}))}};
      return {path:`${durablePath}/global/commands`,body:{type:kind,idempotencyKey:key,expectedRevision:snapshot.revision,epoch:snapshot.epoch}};
    },
    send(attempt) { return request(attempt.path, attempt.body); },
  };
}
