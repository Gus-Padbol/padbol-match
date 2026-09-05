import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatIaClaudeLanguageName,
  chatIaInferWritingLocaleFromConversation,
  chatIaLuxonLocaleForUi,
  normalizeChatIaLocale,
} from './chatIaLocale.js';

test('normalizes every ecosystem language needed by Chivi', () => {
  assert.equal(normalizeChatIaLocale('ro-RO'), 'ro');
  assert.equal(normalizeChatIaLocale('pt-PT'), 'pt');
  assert.equal(normalizeChatIaLocale('fa-IR'), 'fa');
  assert.equal(normalizeChatIaLocale('nl-BE'), 'nl');
  assert.equal(normalizeChatIaLocale('cs-CZ'), 'cs');
  assert.equal(normalizeChatIaLocale('unknown'), 'es');
});

test('detects Romanian and uses the selected language for ambiguous messages', () => {
  assert.equal(chatIaInferWritingLocaleFromConversation('Vreau să rezerv un teren mâine', []), 'ro');
  assert.equal(chatIaInferWritingLocaleFromConversation('Ce turneu este disponibil astăzi?', []), 'ro');
  assert.equal(chatIaInferWritingLocaleFromConversation('OK', [], 'de'), 'de');
});

test('provides Romanian formatting and model language metadata', () => {
  assert.equal(chatIaLuxonLocaleForUi('ro'), 'ro-RO');
  assert.equal(chatIaClaudeLanguageName('ro'), 'Romanian');
  assert.equal(chatIaClaudeLanguageName('he'), 'Hebrew');
});
