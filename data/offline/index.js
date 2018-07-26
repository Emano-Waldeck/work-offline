'use strict';

var args = new URLSearchParams(location.search);

if (args.get('mode') === 'per-tab') {
  document.title += ' (per-tab mode)';
}

var release = () => {
  localStorage.removeItem(args.get('id'));
  location.replace(args.get('rd'));
};

document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;

  if (cmd === 'retry') {
    release();
  }
  else if (cmd === 'go-online' && window.confirm('Are you sure you want to go online?')) {
    chrome.storage.local.set({
      enabled: false
    }, release);
  }
  else if (cmd === 'switch-online' && window.confirm('Are you sure you want to switch to online mode for this tab?')) {
    chrome.runtime.sendMessage({
      method: 'remove.tab'
    }, release);
  }
});

document.body.dataset.mode = args.get('mode');
chrome.storage.onChanged.addListener(prefs => {
  document.body.dataset.mode = prefs.enabled.newValue ? 'global' : args.get('mode');
});

// save to session restore
localStorage.setItem(args.get('id'), args.get('rd'));
