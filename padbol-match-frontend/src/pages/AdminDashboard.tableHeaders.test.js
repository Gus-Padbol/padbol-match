const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'AdminDashboard.jsx'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'AdminDashboard.css'), 'utf8');

describe('encabezados de tablas administrativas', () => {
  it('usa el mismo tratamiento rojo sutil en Roles', () => {
    expect(page.match(/className="admin-table-heading"/g)).toHaveLength(4);
    expect(css).toMatch(/\.admin-table-heading > th/);
    expect(css).toMatch(/linear-gradient\(135deg, #c81018 0%, #ef2631 50%, #bf0f1a 100%\)/);
  });
});
