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
    expect(css).toContain('.admin-dashboard--super .admin-config-puntos-table thead th')
    expect(css).toContain('.admin-torneo-list-card')
    expect(css).toContain('.admin-torneo-list-chip')
    expect(css).toContain('--admin-panel-surface')
    expect(css).toContain('--admin-panel-control')
    expect(css).toContain('.admin-torneo-action--view')
    expect(css).toContain('color: #86efac !important')
    expect(css).toContain('.admin-validacion-action--approve')
    expect(css).toContain('.admin-validacion-level-chip')
    expect(css).toContain('.admin-sponsors-primary-action')
    expect(css).toContain('.admin-dashboard-sidebar-btn__badge--red')
  })

  it('does not separate the new points-level row with a dashed divider', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/pages/AdminDashboard.jsx'), 'utf8')
    expect(page).not.toContain("borderTop: '2px dashed #e9d5ff'")
    expect(page).toContain("borderTop: '1px solid var(--border)'")
  })
})
