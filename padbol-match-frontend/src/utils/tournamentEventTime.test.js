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
