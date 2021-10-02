'use strict';

Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  writable: true,
  value: true
});

document.body.dispatchEvent(new Event('online', {
  bubbles: true
}));
