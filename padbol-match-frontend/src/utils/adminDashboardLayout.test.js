/**
 * Layout strategy guards for AdminDashboard (responsive height / single scroll + sticky sidebar).
 * The CSS must keep document scroll as the only vertical scroller on desktop
 * so Windows DPI / short viewports do not trap content in a tiny nested panel,
 * while the sidebar stays sticky for the full content height.
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../pages/AdminDashboard.css');
const css = fs.readFileSync(cssPath, 'utf8');
const jsxPath = path.join(__dirname, '../pages/AdminDashboard.jsx');
const jsx = fs.readFileSync(jsxPath, 'utf8');
const appPath = path.join(__dirname, '../App.js');
const appSrc = fs.readFileSync(appPath, 'utf8');
const indexCssPath = path.join(__dirname, '../index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

function extractDesktopWithSidebarBlock(source) {
  const mediaIdx = source.indexOf('@media (min-width: 768px)');
  expect(mediaIdx).toBeGreaterThanOrEqual(0);
  const fromMedia = source.slice(mediaIdx);
  const start = fromMedia.indexOf('.admin-dashboard--with-sidebar {');
  expect(start).toBeGreaterThanOrEqual(0);
  const endMarkers = [
    fromMedia.indexOf('/* Short notebook'),
    fromMedia.indexOf('@media (max-width: 767px)'),
  ].filter((i) => i > start);
  const end = endMarkers.length ? Math.min(...endMarkers) : fromMedia.length;
  return fromMedia.slice(start, end);
}

function extractRuleBody(block, selector) {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    's',
  );
  const m = block.match(re);
  expect(m).toBeTruthy();
  return m[1];
}

function extractMobileBlock(source) {
  const mediaIdx = source.indexOf('@media (max-width: 767px)');
  expect(mediaIdx).toBeGreaterThanOrEqual(0);
  return source.slice(mediaIdx, mediaIdx + 800);
}

describe('AdminDashboard layout strategy', () => {
  const block = extractDesktopWithSidebarBlock(css);

  it('root uses min-height viewport and does not lock max-height to 100dvh', () => {
    expect(block).toMatch(/min-height:\s*100dvh/);
    expect(block).toMatch(/max-height:\s*none/);
    expect(block).not.toMatch(/max-height:\s*100dvh/);
  });

  it('1. sidebar uses sticky on desktop', () => {
    const navCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-nav');
    expect(navCss).toMatch(/position:\s*sticky/);
  });

  it('2. sticky top respects AppHeader stack height', () => {
    const navCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-nav');
    expect(navCss).toMatch(
      /top:\s*calc\(\s*var\(--pm-app-header-stack-height,\s*86px\)\s*\+\s*8px\s*\)/,
    );
    expect(indexCss).toMatch(/--pm-app-header-stack-height:/);
  });

  it('3. relevant ancestors do not cancel sticky with overflow != visible', () => {
    expect(block).toMatch(
      /\.admin-dashboard--with-sidebar\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(block).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-main-scroll\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(block).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-shell\s*\{[^}]*overflow:\s*visible/s,
    );
  });

  it('4. shell wrapper sizes to content (accompanies full panel height)', () => {
    const shellCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-shell');
    expect(shellCss).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(shellCss).toMatch(/min-height:\s*auto/);
    expect(shellCss).not.toMatch(/min-height:\s*0/);
    expect(shellCss).toMatch(/align-items:\s*flex-start/);

    const mainCss = extractRuleBody(
      block,
      '.admin-dashboard--with-sidebar .admin-dashboard-main-scroll',
    );
    expect(mainCss).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(mainCss).toMatch(/min-height:\s*auto/);
  });

  it('5. sidebar can scroll internally if its list overflows', () => {
    const navCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-nav');
    expect(navCss).toMatch(/overflow-y:\s*auto/);
    expect(navCss).toMatch(/max-height:\s*calc\(100(?:dvh|svh)/);
    expect(navCss).toMatch(/align-self:\s*flex-start/);
  });

  it('6. right panel keeps overflow visible', () => {
    const panelCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-panel');
    expect(panelCss).toMatch(/overflow:\s*visible/);
    expect(panelCss).not.toMatch(/overflow-y:\s*auto/);
  });

  it('7. document remains the primary vertical scroll', () => {
    expect(css).toMatch(/Single vertical scroll = document\/window/);
    expect(block).not.toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-panel\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(block).not.toMatch(/max-height:\s*100dvh/);
  });

  it('8. footer sits after app content (LegalFooterBar after routes shell)', () => {
    expect(appSrc).toMatch(/LegalFooterBar/);
    const footerIdx = appSrc.indexOf('<LegalFooterBar');
    const routesIdx = appSrc.indexOf('<Routes');
    expect(footerIdx).toBeGreaterThan(routesIdx);
  });

  it('9. mobile/tablet does not force desktop sticky sidebar', () => {
    const mobile = extractMobileBlock(css);
    expect(mobile).toMatch(/\.admin-dashboard-sidebar\s*\{[^}]*display:\s*none\s*!important/s);
    expect(mobile).not.toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-nav\s*\{[^}]*position:\s*sticky/s,
    );
  });

  it('10. no regression of prior responsive fix (document scroll + no nested panel scroller)', () => {
    expect(block).toMatch(/min-height:\s*100dvh/);
    expect(block).toMatch(/max-height:\s*none/);
    const panelCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-panel');
    expect(panelCss).toMatch(/overflow:\s*visible/);
    expect(jsx).toMatch(/admin-dashboard--with-sidebar/);
    expect(jsx).toMatch(/className="admin-dashboard-nav"/);
  });
});
