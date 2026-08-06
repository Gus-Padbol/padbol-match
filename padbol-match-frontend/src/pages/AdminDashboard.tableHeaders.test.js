const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'AdminDashboard.jsx'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'AdminDashboard.css'), 'utf8');

describe('encabezados de tablas administrativas', () => {
  it('usa la superficie sobria compartida del panel', () => {
    expect(page.match(/className="admin-table-heading"/g)).toHaveLength(4);
    expect(css).toMatch(/\.admin-table-heading > th/);
    expect(css).toMatch(/linear-gradient\(145deg, rgba\(255,255,255,\.075\), transparent 30%\)/);
    expect(css).toMatch(/border-top: 1px solid color-mix\(in srgb, var\(--accent\) 68%, var\(--border\)\)/);
  });
});
