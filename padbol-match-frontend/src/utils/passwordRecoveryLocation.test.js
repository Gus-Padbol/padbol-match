import { isPasswordRecoveryLocation } from './passwordRecoveryLocation';

describe('isPasswordRecoveryLocation', () => {
  it('recognizes Supabase recovery links and the legacy same-origin marker', () => {
    expect(isPasswordRecoveryLocation({ hash: '#access_token=secret&type=recovery' })).toBe(true);
    expect(isPasswordRecoveryLocation({ search: '?password_reset=1' })).toBe(true);
  });

  it('does not treat ordinary login links as password recovery', () => {
    expect(isPasswordRecoveryLocation({ search: '?login=1', hash: '' })).toBe(false);
    expect(isPasswordRecoveryLocation({ hash: '#type=signup' })).toBe(false);
  });
});

