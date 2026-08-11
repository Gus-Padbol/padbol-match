import es from '../../i18n/locales/es.json';
import en from '../../i18n/locales/en.json';

const itemKeys = ['setup', 'bookings', 'players', 'competition', 'scoreboard', 'loyalty'];

describe.each([
  ['es', es],
  ['en', en],
])('public venue administration copy (%s)', (_locale, messages) => {
  const section = messages.publicSite.venueAdmin;

  it('contains the section and next-step copy', () => {
    expect(section.eyebrow).toBeTruthy();
    expect(section.title).toBeTruthy();
    expect(section.text).toBeTruthy();
    expect(section.openDetail).toBeTruthy();
    expect(section.close).toBeTruthy();
    expect(section.next).toEqual(expect.objectContaining({
      eyebrow: expect.any(String),
      title: expect.any(String),
      text: expect.any(String),
      apply: expect.any(String),
    }));
  });

  it.each(itemKeys)('contains complete copy for %s', (key) => {
    const item = section.items[key];
    expect(item).toEqual(expect.objectContaining({
      title: expect.any(String),
      text: expect.any(String),
      detail: expect.any(String),
      result: expect.any(String),
    }));
    expect(item.steps).toEqual(expect.objectContaining({
      1: expect.any(String),
      2: expect.any(String),
      3: expect.any(String),
    }));
  });
});
