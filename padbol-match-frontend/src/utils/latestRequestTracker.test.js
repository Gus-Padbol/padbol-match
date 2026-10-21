import { createLatestRequestTracker } from './latestRequestTracker';

test('an older response cannot replace the list after the session changes', async () => {
  const tracker = createLatestRequestTracker();
  const shown = [];
  let resolveOld;
  const oldResponse = new Promise((resolve) => { resolveOld = resolve; });
  const oldId = tracker.begin();
  const oldRender = oldResponse.then((value) => { if (tracker.isCurrent(oldId)) shown.push(value); });
  tracker.invalidate();
  const newId = tracker.begin();
  if (tracker.isCurrent(newId)) shown.push('new session');
  resolveOld('previous private session');
  await oldRender;
  expect(shown).toEqual(['new session']);
});
