import fs from 'fs'
import path from 'path'

const page = fs.readFileSync(path.join(process.cwd(), 'src/pages/ScoreboardControl.jsx'), 'utf8')
const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/ScoreboardControl.css'), 'utf8')

describe('restart after a finished scoreboard match', () => {
  it('offers an explicit restart that uses the complete-match reset endpoint', () => {
    expect(page).toContain('const handleRestartMatch')
    expect(page).toContain('/cronometro/reset')
    expect(page).toContain('Iniciar otro partido')
    expect(css).toContain('.sc-finished-banner__restart')
  })
})
