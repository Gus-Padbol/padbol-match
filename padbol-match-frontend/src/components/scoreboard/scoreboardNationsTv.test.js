import fs from 'fs';
import path from 'path';

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const board = read('ScoreboardBoard.jsx');
const display = fs.readFileSync(path.join(__dirname, '../../pages/ScoreboardDisplay.jsx'), 'utf8');
const winner = read('ScoreboardWinnerScreen.jsx');
const css = fs.readFileSync(path.join(__dirname, '../../styles/ScoreboardDisplay.css'), 'utf8');

test('Nations TV is English and identity-safe', () => {
  expect(board).toContain("active:'On court'");
  expect(board).toContain("bench:'Bench'");
  expect(board).not.toContain("bench:'Substitutes'");
  expect(board).toContain('aria-label="Serving"');
  expect(board).toContain('>Serving</span>');
  expect(board).toContain('>Time</span>');
  expect(winner).toContain('Match finished');
  expect(board).toContain('showAvatar={false}');
  expect((board.match(/showAvatar=\{false\}/g) || []).length).toBe(3);
  expect(board).not.toContain('foto_url={');
  expect(css).toContain('.sb-display--nations .sb-team-name,.sb-display--nations .sb-player__name{text-transform:none}');
  expect(css).toContain('.sb-display--nations .sb-tournament-brand__name{text-transform:none}');
  expect(css).toContain('.sb-display--nations .sb-lineup__label,.sb-display--nations .sb-timer__label{text-transform:none');
});

test('fit mode and moving white footer stay scoped to Nations; legacy keeps its original footer', () => {
  expect(board).toContain("lineup.isNations ? ' sb-display--fit sb-display--nations' : ''");
  expect(board).toContain('lineup.isNations ? <NationsScoreboardTicker sponsors={sponsors} />');
  expect(board).toContain('src="/brand/padbol-match-logo-on-dark.png"');
  expect(css).toContain('animation:sb-nations-marquee 32s linear infinite');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  expect(css).toContain('.sb-display--nations .sb-nations-marquee__content{animation:none;transform:none;will-change:auto;min-width:0}');
});

test('Nations load errors use the English fallback only after the DTO identifies Nations', () => {
  expect(display).toContain("const isNations = ['current', 'unavailable'].includes(partido?.nations_lineup_status)");
  expect(display).toContain("setError(isNations ? 'Unable to load the match.'");
  expect(display).toContain('err.message || t(\'scoreboardDisplay.matchLoadError\')');
});
