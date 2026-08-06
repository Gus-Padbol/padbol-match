import fs from 'fs'
import path from 'path'

const css = fs.readFileSync(path.join(process.cwd(), 'src/pages/AdminDashboard.css'), 'utf8')

describe('admin visual system', () => {
  it('uses the shared subtle red treatment for headings and legacy action controls', () => {
    expect(css).toContain('--admin-accent-gradient: linear-gradient(135deg, #c81018 0%, #ef2631 50%, #bf0f1a 100%)')
    expect(css).toContain('.admin-dashboard :is(button, a)[style*="#E11B22"]')
    expect(css).toContain('.admin-dashboard tr[style*="#E11B22"] > th')
    expect(css).toContain('.section h2')
    expect(css).toContain('border-bottom: 1px solid var(--admin-accent-border)')
  })
})
