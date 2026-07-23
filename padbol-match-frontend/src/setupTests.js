// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

const { TextDecoder, TextEncoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

if (typeof window !== 'undefined' && window.HTMLMediaElement) {
  Object.defineProperties(window.HTMLMediaElement.prototype, {
    load: {
      configurable: true,
      value: jest.fn(),
    },
    pause: {
      configurable: true,
      value: jest.fn(),
    },
    play: {
      configurable: true,
      value: jest.fn(() => Promise.resolve()),
    },
  });
}
