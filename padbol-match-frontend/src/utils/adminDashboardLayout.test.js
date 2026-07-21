/**
 * Layout strategy guards for AdminDashboard:
 * - document/window is the only vertical scroller on desktop
 * - sidebar is position:fixed (sticky is forbidden after real QA failure)
 * - placeholder reserves sidebar width so the panel is not covered
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
  const from = source.slice(mediaIdx);
  const nextMedia = from.indexOf('@media', 1);
  return nextMedia > 0 ? from.slice(0, nextMedia) : from.slice(0, 2000);
}

function extractDesktopMediaPrefix(source) {
  const mediaIdx = source.indexOf('@media (min-width: 768px)');
  expect(mediaIdx).toBeGreaterThanOrEqual(0);
  const fromMedia = source.slice(mediaIdx);
  const end = fromMedia.indexOf('/* Short notebook');
  return fromMedia.slice(0, end > 0 ? end : 3500);
}

describe('AdminDashboard layout strategy — fixed sidebar', () => {
  const block = extractDesktopWithSidebarBlock(css);
  const desktopPrefix = extractDesktopMediaPrefix(css);
  const mobile = extractMobileBlock(css);

  it('root uses min-height viewport and does not lock max-height to 100dvh', () => {
    expect(block).toMatch(/min-height:\s*100dvh/);
    expect(block).toMatch(/max-height:\s*none/);
    expect(block).not.toMatch(/max-height:\s*100dvh/);
  });

  it('1. desktop uses position:fixed on sidebar', () => {
    const sideCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-sidebar');
    expect(sideCss).toMatch(/position:\s*fixed/);
  });

  it('2. desktop no longer uses sticky for sidebar/nav', () => {
    const sideCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-sidebar');
    const navCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-nav');
    expect(sideCss).not.toMatch(/position:\s*sticky/);
    expect(navCss).not.toMatch(/position:\s*sticky/);
    expect(desktopPrefix).not.toMatch(
      /\.admin-dashboard-nav\s*\{[^}]*position:\s*sticky/s,
    );
    expect(block).not.toMatch(/position:\s*sticky/);
  });

  it('3. sidebar top uses shared --pm-admin-sidebar-top variable', () => {
    expect(block).toMatch(/--pm-admin-sidebar-top:\s*calc\(\s*var\(--pm-app-header-stack-height/);
    const sideCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-sidebar');
    expect(sideCss).toMatch(/top:\s*var\(--pm-admin-sidebar-top\)/);
    expect(indexCss).toMatch(/--pm-app-header-stack-height:/);
  });

  it('4. sidebar max-height is based on 100dvh/svh and shared top', () => {
    const sideCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-sidebar');
    expect(sideCss).toMatch(
      /max-height:\s*calc\(\s*100(?:dvh|svh)\s*-\s*var\(--pm-admin-sidebar-top\)/,
    );
  });

  it('5. sidebar has overflow-y auto for long lists', () => {
    const sideCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-sidebar');
    expect(sideCss).toMatch(/overflow-y:\s*auto/);
  });

  it('6. main content reserves sidebar width via placeholder + slot', () => {
    const navCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-nav');
    expect(navCss).toMatch(/flex:\s*0\s+0\s+var\(--pm-admin-sidebar-width/);
    expect(navCss).toMatch(/width:\s*var\(--pm-admin-sidebar-width/);
    expect(block).toMatch(/--pm-admin-sidebar-width:\s*232px/);
    expect(block).toMatch(/--pm-admin-sidebar-slot:/);
    const brandCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-brand-shell');
    // BUG-03: the header box must START after the sidebar (margin), not just pad
    // its content — otherwise its background/border runs behind the fixed nav.
    expect(brandCss).toMatch(/margin-left:\s*calc\(\s*var\(--pm-admin-sidebar-shell-pad-x\)\s*\+\s*var\(--pm-admin-sidebar-slot\)/);
    expect(brandCss).not.toMatch(/padding-left:\s*calc\(/);
  });

  it('7. content is not placed under sidebar (panel flex + nav placeholder)', () => {
    const panelCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-panel');
    expect(panelCss).toMatch(/flex:\s*1\s+1\s+auto/);
    expect(panelCss).toMatch(/min-width:\s*0/);
    expect(jsx).toMatch(/className="admin-dashboard-nav"/);
    expect(jsx).toMatch(/className="admin-dashboard-sidebar"/);
  });

  it('8. window/document remains the primary vertical scroll', () => {
    expect(css).toMatch(/Single vertical scroll = document\/window/);
    expect(block).not.toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-panel\s*\{[^}]*overflow-y:\s*auto/s,
    );
  });

  it('9. right panel keeps overflow visible', () => {
    const panelCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-panel');
    expect(panelCss).toMatch(/overflow:\s*visible/);
    expect(panelCss).not.toMatch(/overflow-y:\s*auto/);
  });

  it('10. footer stays after app content', () => {
    expect(appSrc).toMatch(/LegalFooterBar/);
    expect(appSrc.indexOf('<LegalFooterBar')).toBeGreaterThan(appSrc.indexOf('<Routes'));
  });

  it('11. no rigid max-height:100dvh on main layout', () => {
    expect(block).not.toMatch(/max-height:\s*100dvh/);
    expect(block).toMatch(/max-height:\s*none/);
  });

  it('12. no overflow hidden on shell/main-scroll', () => {
    expect(block).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-main-scroll\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(block).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-shell\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(block).not.toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-shell\s*\{[^}]*overflow:\s*hidden/s,
    );
  });

  it('13. tablet/mobile removes position fixed on sidebar', () => {
    expect(mobile).toMatch(/\.admin-dashboard-sidebar\s*\{[^}]*position:\s*static\s*!important/s);
    expect(mobile).toMatch(/display:\s*none\s*!important/);
  });

  it('14. tablet/mobile removes lateral compensation', () => {
    expect(mobile).toMatch(/--pm-admin-sidebar-slot:\s*0px/);
    expect(mobile).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-brand-shell\s*\{[^}]*margin-left:\s*0/s,
    );
    expect(mobile).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-brand-shell\s*\{[^}]*padding-left:\s*0/s,
    );
  });

  it('15. mobile keeps current strip menu behavior', () => {
    expect(mobile).toMatch(/\.admin-dashboard-tabs-strip--mobile\s*\{[^}]*display:\s*flex/s);
    expect(mobile).toMatch(/\.admin-dashboard-sidebar\s*\{[^}]*display:\s*none\s*!important/s);
  });

  it('16. header stays above sidebar (z-index)', () => {
    expect(indexCss).toMatch(/\.app-header-shell\s*\{[^}]*z-index:\s*1002/s);
    expect(block).toMatch(/--pm-admin-sidebar-z:\s*40/);
    const sideCss = extractRuleBody(block, '.admin-dashboard--with-sidebar .admin-dashboard-sidebar');
    expect(sideCss).toMatch(/z-index:\s*var\(--pm-admin-sidebar-z\)/);
  });

  it('17. modals stay above sidebar', () => {
    expect(css).toMatch(/z-index:\s*1?9?\d{3,}/);
    expect(css).toMatch(/z-index:\s*12000|z-index:\s*19050|z-index:\s*9999|z-index:\s*100000/);
  });

  it('18. does not alter module-specific rules (mi sede pagos / metrics helpers untouched in CSS scope)', () => {
    expect(css).toMatch(/admin-mi-sede/);
    // Layout block must not redefine module metric class names
    expect(block).not.toMatch(/admin-club-metricas|padcoins|membresias/);
  });

  it('19. keeps prior responsive fix (document scroll + content grow)', () => {
    expect(block).toMatch(/min-height:\s*100dvh/);
    expect(block).toMatch(/flex:\s*0\s+0\s+auto/);
    const mainCss = extractRuleBody(
      block,
      '.admin-dashboard--with-sidebar .admin-dashboard-main-scroll',
    );
    expect(mainCss).toMatch(/overflow:\s*visible/);
  });

  it('20. guards against accidental return to sticky', () => {
    expect(block).toMatch(/Do not use sticky|sticky discarded|sticky failed/i);
    expect(block).not.toMatch(/position:\s*sticky/);
    expect(desktopPrefix.match(/position:\s*sticky/g) || []).toHaveLength(0);
  });
});
