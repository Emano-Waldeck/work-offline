'use strict';
{
  const script = document.createElement('script');
  script.textContent = `
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      writable: true,
      value: false
    });
    document.body.dispatchEvent(new Event('offline', {
      bubbles: true
    }));
    `;
  document.documentElement.appendChild(script);
  script.remove();
}
window.stop();
