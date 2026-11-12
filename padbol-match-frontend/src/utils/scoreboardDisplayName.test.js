import {formatDisplayName,formatTeamDisplayName} from './scoreboardDisplayName';

test.each([
 ['JUAN PÉREZ', 'Juan Pérez'],
 ['DE LA CRUZ', 'De la Cruz'],
 ['MCDONALD', 'Mcdonald'],
 ['McDonald', 'McDonald'],
 ['de la Cruz', 'de la Cruz'],
 ["O'CONNOR", "O'Connor"],
 ['JEAN-PIERRE', 'Jean-Pierre'],
 ['MUÑOZ ÜBER', 'Muñoz Über'],
 ['JUAN PÉREZ III', 'Juan Pérez III'],
 ['  A   /   B  ', '  A   /   B  '],
 ['A/B', 'A/B'],
 ['ANA Y EVA', 'Ana y Eva'],
 ['VAN DE BERG', 'Van de Berg'],
])('formats only uppercase tokens without changing separators: %s', (input, expected) => {
 expect(formatDisplayName(input)).toBe(expected);
});

test('team display uses the same contract and never reorders',()=>{
 expect(formatTeamDisplayName('ESPAÑA / ARGENTINA')).toBe('España / Argentina');
 expect(formatTeamDisplayName('McDonald / DE LA CRUZ')).toBe('McDonald / De la Cruz');
});
