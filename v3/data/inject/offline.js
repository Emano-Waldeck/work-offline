'use strict';

Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  writable: true,
  value: false
});

document.body.dispatchEvent(new Event('offline', {
  bubbles: true
}));

window.stop();
