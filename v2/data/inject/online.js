'use strict';
{
  const script = document.createElement('script');
  script.textContent = `
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      writable: true,
      value: true
    });
    document.body.dispatchEvent(new Event('online', {
      bubbles: true
    }));
    `;
  document.documentElement.appendChild(script);
  script.remove();
}
