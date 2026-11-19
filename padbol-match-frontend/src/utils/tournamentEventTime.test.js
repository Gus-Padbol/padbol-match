import {formatTournamentEventTime,tournamentEventTimeZone} from './tournamentEventTime';
test('event clock retains Rome time independently of viewer and across DST',()=>{
 expect(formatTournamentEventTime('2026-11-20T07:00:00Z','Europe/Rome')).toContain('08:00');
 expect(formatTournamentEventTime('2026-07-20T06:00:00Z','Europe/Rome')).toContain('08:00');
 expect(formatTournamentEventTime('2026-11-20T07:00:00Z','Europe/Rome')).toContain('Europe/Rome');
 expect(formatTournamentEventTime('bad','Europe/Rome')).toBe('');
 expect(formatTournamentEventTime('2026-11-20T07:00:00Z','invalid')).toBe('Horario no confirmado');
});
test('persisted event config supplies clock before state loads',()=>{
 expect(tournamentEventTimeZone({plan_nations:{config:{timezone:'Europe/Rome'}}},null)).toBe('Europe/Rome');
 expect(tournamentEventTimeZone({}, {config:{timezone:'UTC'}})).toBe('UTC');
 expect(tournamentEventTimeZone({plan_nations:{enabled:true,format:'nations_3x5',timezone:'Europe/Rome'}},null)).toBe('Europe/Rome');
 expect(tournamentEventTimeZone({},null)).toBeUndefined();
});

test('legacy UTC-naive timestamps render 10:30/12:15 in Rome from BA and Rome runtimes',()=>{expect(formatTournamentEventTime('2026-11-20T09:30:00','Europe/Rome')).toContain('10:30');expect(formatTournamentEventTime('2026-11-21T11:15:00','Europe/Rome')).toContain('12:15');});

test('resolver uses schedule/partido zone before event plan and keeps 57 explicit',()=>{
 expect(tournamentEventTimeZone({id:57},null)).toBe('Europe/Rome');
 expect(tournamentEventTimeZone({id:57,plan_nations:{timezone:'Europe/Rome'}},null,{timezone:'America/New_York'})).toBe('America/New_York');
 expect(tournamentEventTimeZone({id:99,timezone:'America/New_York'},null)).toBe('America/New_York');
 expect(tournamentEventTimeZone({id:99},null)).toBeUndefined();
});
