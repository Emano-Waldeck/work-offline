'use strict';

var args = (location.search || '?').substr(1).split('&').reduce((p, c) => {
  const [key, value] = c.split('=');
  p[key] = decodeURIComponent(value);

  return p;
}, {});

document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;

  if (cmd === 'retry') {
    location.replace(args.rd);
  }
  else if (cmd === 'go-online' && window.confirm('Are you sure you want to go online?')) {
    chrome.storage.local.set({
      enabled: false
    }, () => location.replace(args.rd));
  }
});
