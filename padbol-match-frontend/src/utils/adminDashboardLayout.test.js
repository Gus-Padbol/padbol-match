/**
 * Layout strategy guards for AdminDashboard (responsive height / single scroll).
 * The CSS must keep document scroll as the only vertical scroller on desktop
 * so Windows DPI / short viewports do not trap content in a tiny nested panel.
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../pages/AdminDashboard.css');
const css = fs.readFileSync(cssPath, 'utf8');

function extractDesktopWithSidebarBlock(source) {
  const mediaIdx = source.indexOf('@media (min-width: 768px)');
  expect(mediaIdx).toBeGreaterThanOrEqual(0);
  const fromMedia = source.slice(mediaIdx);
  const start = fromMedia.indexOf('.admin-dashboard--with-sidebar {');
  expect(start).toBeGreaterThanOrEqual(0);
  // Grab consecutive with-sidebar rules until short-height media or mobile media
  const endMarkers = [
    fromMedia.indexOf('/* Short notebook'),
    fromMedia.indexOf('@media (max-width: 767px)'),
  ].filter((i) => i > start);
  const end = endMarkers.length ? Math.min(...endMarkers) : fromMedia.length;
  return fromMedia.slice(start, end);
}

describe('AdminDashboard layout strategy', () => {
  const block = extractDesktopWithSidebarBlock(css);

  it('root uses min-height viewport and does not lock max-height to 100dvh', () => {
    expect(block).toMatch(/min-height:\s*100dvh/);
    expect(block).toMatch(/max-height:\s*none/);
    expect(block).not.toMatch(/max-height:\s*100dvh/);
  });

  it('main-scroll and shell do not clip with overflow hidden', () => {
    expect(block).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-main-scroll\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(block).toMatch(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-shell\s*\{[^}]*overflow:\s*visible/s,
    );
  });

  it('content panel is not a nested vertical scroller', () => {
    const panelMatch = block.match(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-panel\s*\{([^}]*)\}/s,
    );
    expect(panelMatch).toBeTruthy();
    const panelCss = panelMatch[1];
    expect(panelCss).toMatch(/overflow:\s*visible/);
    expect(panelCss).not.toMatch(/overflow-y:\s*auto/);
  });

  it('sidebar stays sticky with its own max-height for long nav lists', () => {
    const navMatch = block.match(
      /\.admin-dashboard--with-sidebar \.admin-dashboard-nav\s*\{([^}]*)\}/s,
    );
    expect(navMatch).toBeTruthy();
    const navCss = navMatch[1];
    expect(navCss).toMatch(/position:\s*sticky/);
    expect(navCss).toMatch(/overflow-y:\s*auto/);
  });

  it('documents the single-scroll strategy in CSS comments', () => {
    expect(css).toMatch(/Single vertical scroll = document\/window/);
  });
});
