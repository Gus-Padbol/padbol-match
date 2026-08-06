import { badgeTorneoEstadoPublico } from './torneoEstadoPublico'

describe('torneo status badges', () => {
  it('keeps the active tournament state legible on dark admin surfaces', () => {
    expect(badgeTorneoEstadoPublico('en_curso')).toMatchObject({
      label: 'En curso',
      bg: '#14532d',
      color: '#bbf7d0',
    })
  })
})
